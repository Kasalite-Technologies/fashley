import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDb } from "./db";
import { createTailorHandlers, type TailorHttpDeps } from "./http";
import { InMemoryMediaStore } from "./media";
import { ensureLocalUser, createConsent } from "./identity";
import { createProject, saveDraft, freezeRevision, insertAsset } from "./projects";
import { emptyProjectInput } from "../contracts";

const MIGRATIONS = readdirSync(join(process.cwd(), "migrations/tailor"))
  .sort()
  .map((f) => readFileSync(join(process.cwd(), "migrations/tailor", f), "utf8"));
async function makeDb() {
  const db = new InMemoryDb();
  for (const sql of MIGRATIONS) await db.exec(sql);
  await db
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
      JSON.stringify({
        requiredLengthMm: 2000,
        ruleVersion: "test-rule-v1",
        requiredMeasurements: ["bust"],
      }),
      "TEST ONLY fixture reviewer",
      Date.now(),
      Date.now(),
    )
    .run();
  return db;
}
const KEY = (n: string) => `http-test-key-${n}-1234567890`;
const PNG = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function makeHandlers(db: InMemoryDb, extra: Partial<TailorHttpDeps> = {}) {
  return createTailorHandlers({
    db,
    verifier: async (request) => {
      const m = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
      if (!m?.[1]) return null;
      return { subject: m[1], displayName: m[1], email: `${m[1]}@example.invalid` };
    },
    media: new InMemoryMediaStore(),
    ...extra,
  });
}
const req = (subject: string, key?: string) => ({
  headers: {
    authorization: `Bearer ${subject}`,
    "content-type": "application/json",
    ...(key ? { "Idempotency-Key": key } : {}),
  },
});
const jsonReq = (subject: string, key: string, body: unknown) =>
  new Request("http://test/api", {
    method: "POST",
    ...req(subject, key),
    body: JSON.stringify(body),
  });

async function seedProject(db: InMemoryDb, subject: string) {
  const { userId } = await ensureLocalUser(db, {
    subject,
    displayName: subject,
    email: `${subject}@example.invalid`,
  });
  const created = await createProject(db, userId, KEY(`create-${subject}`), {
    title: "Test dress",
    template: { id: "tpl_test", version: 1 },
    occasion: null,
    deadline: null,
    fit: "regular",
    timezone: "Africa/Accra",
  });
  return { userId, projectId: created.detail.project.id };
}

describe("tailor HTTP media + jobs integration", () => {
  it("upload intent -> content -> complete -> owner asset content, cross-user 404", async () => {
    const db = await makeDb();
    const handlers = makeHandlers(db);
    const { userId, projectId } = await seedProject(db, "user_a");
    const consent = await createConsent(db, userId, KEY("consent-a"), {
      purpose: "ai_fabric",
      policyVersion: "tailor-policy-v1",
    });
    const intentRes = await handlers.createUploadIntent(
      jsonReq("user_a", KEY("intent-1"), {
        kind: "fabric_source",
        mime: "image/png",
        bytes: PNG.byteLength,
        consentId: consent.consent.id,
      }),
      projectId,
    );
    expect(intentRes.status).toBe(201);
    const intent = (await intentRes.json()).data;
    expect(intent.putUrl).toContain(`/uploads/${intent.uploadId}/content`);

    const putRes = await handlers.uploadContent(
      new Request("http://test/api", { method: "PUT", ...req("user_a"), body: PNG }),
      projectId,
      intent.uploadId,
    );
    expect(putRes.status).toBe(200);
    expect((await putRes.json()).data.status).toBe("received");

    const completeRes = await handlers.completeUpload(
      jsonReq("user_a", KEY("complete-1"), {}),
      projectId,
      intent.uploadId,
    );
    expect(completeRes.status).toBe(200);
    const completed = (await completeRes.json()).data;
    expect(completed.status).toBe("ready");
    expect(completed.asset.kind).toBe("fabric_source");

    const contentRes = await handlers.assetContent(
      new Request("http://test/api", req("user_a")),
      completed.asset.id,
    );
    expect(contentRes.status).toBe(200);
    expect(contentRes.headers.get("content-type")).toBe("image/png");

    const crossRes = await handlers.assetContent(
      new Request("http://test/api", req("user_b")),
      completed.asset.id,
    );
    expect(crossRes.status).toBe(404);
  });

  it("jobs fail closed without workflow, dispatch and read back with one", async () => {
    const db = await makeDb();
    const { userId, projectId } = await seedProject(db, "user_a");
    const input = emptyProjectInput("Test dress", "Africa/Accra");
    input.template = { id: "tpl_test", version: 1 };
    input.fabric.sourceAssetId = "ast_src";
    await insertAsset(db, {
      id: "ast_src",
      projectId,
      ownerUserId: userId,
      kind: "fabric_source",
      mime: "image/png",
      bytes: PNG.byteLength,
      widthPx: 1,
      heightPx: 1,
    });
    await saveDraft(db, userId, projectId, { expectedDraftVersion: 1, input });
    const frozen = await freezeRevision(db, userId, projectId, KEY("freeze-1"), {
      expectedDraftVersion: 2,
      expectedProjectVersion: 2,
    });

    const closed = makeHandlers(db);
    const closedRes = await closed.startJob(
      jsonReq("user_a", KEY("job-closed"), {
        type: "analyze_fabric",
        revisionId: frozen.revision.id,
      }),
      projectId,
    );
    expect(closedRes.status).toBe(503);
    expect((await closedRes.json()).error.code).toBe("FEATURE_UNAVAILABLE");

    const dispatched: string[] = [];
    const handlers = makeHandlers(db, {
      workflow: {
        dispatch: async (jobId: string) => {
          dispatched.push(jobId);
          return { workflowId: jobId };
        },
      },
    });
    const startRes = await handlers.startJob(
      jsonReq("user_a", KEY("job-1"), { type: "analyze_fabric", revisionId: frozen.revision.id }),
      projectId,
    );
    expect(startRes.status).toBe(201);
    const started = (await startRes.json()).data;
    expect(started.job.state).toBe("queued");
    expect(started.credits.reserved).toBe(0);
    expect(dispatched).toEqual([started.job.id]);

    const getRes = await handlers.getJob(
      new Request("http://test/api", req("user_a")),
      started.job.id,
    );
    expect(getRes.status).toBe(200);
    expect((await getRes.json()).data.id).toBe(started.job.id);

    const briefRes = await handlers.createBriefJob(
      jsonReq("user_a", KEY("brief-1"), { revisionId: frozen.revision.id }),
      projectId,
    );
    expect(briefRes.status).toBe(201);
    expect((await briefRes.json()).data.job.type).toBe("assemble_brief");
  });
});
