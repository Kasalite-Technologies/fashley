import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDb, type Db } from "./db";
import { createTailorHandlers } from "./http";

// Mock the Clerk backend SDK: verification outcomes are driven per test.
const verifyTokenMock = vi.fn();
const getUserMock = vi.fn();
vi.mock("@clerk/backend", () => ({
  verifyToken: (...args: unknown[]) => verifyTokenMock(...args),
  createClerkClient: () => ({ users: { getUser: (...args: unknown[]) => getUserMock(...args) } }),
}));

import { adaptD1, extractSessionToken, secretResolver, tailorDepsFromEnv, type D1Like } from "./cloudflare";

const MIGRATIONS = readdirSync(join(process.cwd(), "migrations/tailor"))
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(process.cwd(), "migrations/tailor", f), "utf8"));

/** Wrap the in-memory Db in the real D1 binding shape (meta.changes / last_row_id). */
function fakeD1(db: Db): D1Like {
  const wrap = (stmt: ReturnType<Db["prepare"]>): D1Like["prepare"] extends (
    sql: string,
  ) => infer P
    ? P
    : never => {
    const prepared = {
      bind: (...v: unknown[]) => wrap(stmt.bind(...v)),
      run: async () => {
        const r = await stmt.run();
        return { meta: { changes: r.changes, last_row_id: r.lastRowId } };
      },
      first: <T>() => stmt.first<T>(),
      all: <T>() => stmt.all<T>(),
    };
    return prepared as never;
  };
  return {
    prepare: (sql: string) => wrap(db.prepare(sql)),
    batch: async (stmts) => {
      // The fake statements close over the in-memory Db; run them sequentially.
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
    exec: async (sql: string) => {
      await db.exec(sql);
    },
  };
}

async function makeDeps() {
  const mem = new InMemoryDb();
  for (const sql of MIGRATIONS) await mem.exec(sql);
  const d1 = fakeD1(mem);
  // adaptD1.batch needs statements from its own adapter, so exercise batch via handlers below.
  return { mem, d1, deps: tailorDepsFromEnv({ DB: d1, CLERK_SECRET_KEY: "sk_test_dummy" }) };
}

beforeEach(() => {
  verifyTokenMock.mockReset();
  getUserMock.mockReset();
  getUserMock.mockImplementation(async (subject: string) => ({
    firstName: "Test",
    lastName: subject,
    username: null,
    primaryEmailAddressId: "em_1",
    emailAddresses: [{ id: "em_1", emailAddress: `${subject}@example.com` }],
  }));
});

describe("secretResolver", () => {
  it("resolves plain strings and Secrets Store bindings, fails closed otherwise", async () => {
    expect(await secretResolver("sk_x")()).toBe("sk_x");
    expect(await secretResolver("")()).toBeNull();
    expect(await secretResolver({ get: async () => "sk_y" })()).toBe("sk_y");
    expect(
      await secretResolver({
        get: async () => {
          throw new Error("store down");
        },
      })(),
    ).toBeNull();
    expect(await secretResolver(undefined)()).toBeNull();
  });
});

describe("extractSessionToken", () => {
  it("prefers Bearer, falls back to __session cookie", () => {
    expect(
      extractSessionToken(new Request("https://x", { headers: { authorization: "Bearer abc" } })),
    ).toBe("abc");
    expect(
      extractSessionToken(new Request("https://x", { headers: { cookie: "a=1; __session=tok" } })),
    ).toBe("tok");
    expect(extractSessionToken(new Request("https://x"))).toBeNull();
  });
});

describe("tailorDepsFromEnv", () => {
  it("omits deps when bindings are missing (FEATURE_UNAVAILABLE path)", () => {
    const deps = tailorDepsFromEnv({});
    expect(deps.db).toBeUndefined();
    expect(deps.verifier).toBeUndefined();
  });
});

describe("handlers over adapted D1 with Clerk verifier", () => {
  it("returns 401 without a token", async () => {
    const { deps } = await makeDeps();
    const handlers = createTailorHandlers(deps);
    const res = await handlers.me(new Request("https://x/api/tailor/me"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 for an invalid token", async () => {
    verifyTokenMock.mockRejectedValue(new Error("bad signature"));
    const { deps } = await makeDeps();
    const handlers = createTailorHandlers(deps);
    const res = await handlers.me(
      new Request("https://x/api/tailor/me", { headers: { authorization: "Bearer junk" } }),
    );
    expect(res.status).toBe(401);
  });

  it("creates then reads a project for the verified user, and hides it from another user", async () => {
    verifyTokenMock.mockImplementation(async (token: string) => ({ sub: token }));
    const { deps, mem } = await makeDeps();
    const handlers = createTailorHandlers(deps);
    const auth = (sub: string) => ({ authorization: `Bearer ${sub}` });

    await mem
      .prepare(
        "INSERT INTO garment_templates (id, version, status, name, garment_kind, description, illustration_key, measurement_schema_json, design_options_json, rule_json, reviewer_name, reviewed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "tpl_test",
        1,
        "published",
        "Test dress (TEST ONLY)",
        "dress",
        "test fixture",
        null,
        JSON.stringify([
          { name: "bust", kind: "body", label: "Bust", guidance: "tape", required: true, unit: "cm" },
        ]),
        JSON.stringify([]),
        JSON.stringify({ requiredLengthMm: 2000, ruleVersion: "test-rule-v1", requiredMeasurements: ["bust"] }),
        "TEST ONLY fixture reviewer",
        Date.now(),
        Date.now(),
      )
      .run();
    const createRes = await handlers.createProject(
      new Request("https://x/api/tailor/projects", {
        method: "POST",
        headers: { ...auth("user_a"), "Idempotency-Key": "wiring-proof-key-0001", "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Proof dress",
          template: { id: "tpl_test", version: 1 },
          occasion: null,
          deadline: null,
          fit: "regular",
          timezone: "Africa/Accra",
        }),
      }),
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { data: { project: { id: string; title: string } } };
    expect(created.data.project.title).toBe("Proof dress");
    const projectId = created.data.project.id;

    const readRes = await handlers.project(
      new Request(`https://x/api/tailor/projects/${projectId}`, { headers: auth("user_a") }),
      projectId,
    );
    expect(readRes.status).toBe(200);

    const crossRes = await handlers.project(
      new Request(`https://x/api/tailor/projects/${projectId}`, { headers: auth("user_b") }),
      projectId,
    );
    expect(crossRes.status).toBe(404);

    // Identity rows were provisioned through the adapted D1 surface.
    const identities = await mem
      .prepare("SELECT * FROM auth_identities WHERE provider = ?")
      .bind("clerk")
      .all<{ subject: string }>();
    expect(identities.results.map((r) => r.subject).sort()).toEqual(["user_a", "user_b"]);
  });
});

describe("adaptD1", () => {
  it("maps run results from meta", async () => {
    const d1: D1Like = {
      prepare: () => ({
        bind: () => ({
          bind: () => ({}) as never,
          run: async () => ({ meta: { changes: 3, last_row_id: 9 } }),
          first: async () => null,
          all: async () => ({ results: [] }),
        }),
        run: async () => ({ meta: { changes: 3, last_row_id: 9 } }),
        first: async () => null,
        all: async <T,>() => ({ results: [{ a: 1 } as T] }),
      }),
      batch: async () => [{ meta: { changes: 1, last_row_id: null } }],
      exec: async () => ({}),
    };
    const db = adaptD1(d1);
    expect(await db.prepare("UPDATE x").run()).toEqual({ changes: 3, lastRowId: 9 });
    expect(await db.prepare("SELECT").all()).toEqual({ results: [{ a: 1 }] });
  });
});
