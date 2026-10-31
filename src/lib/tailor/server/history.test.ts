import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDb } from "./db";
import { ensureLocalUser } from "./identity";
import {
  createProject,
  freezeRevision,
  getProjectDetail,
  getProjectHistory,
  insertAsset,
  saveDraft,
} from "./projects";
import { assembleBrief } from "./briefs";
import { createTailorHandlers } from "./http";
import { emptyProjectInput, projectDetailSchema, type ProjectInput } from "../contracts";
import { historyListSchema } from "../client/api";

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
const KEY = (n: string) => `history-test-key-${n}-1234567890`;
const BASE = 1_700_000_000_000;
const actor = (s: string) => ({ subject: s, displayName: s, email: `${s}@example.invalid` });

function completeInput(): ProjectInput {
  const input = emptyProjectInput("Test dress", "Africa/Accra");
  input.template = { id: "tpl_test", version: 1 };
  input.fabric = {
    ...input.fabric,
    sourceAssetId: "ast_src",
    selection: {
      method: "manual_crop",
      sourceAssetId: "ast_src",
      cropAssetId: "ast_crop",
      maskAssetId: null,
      regionId: null,
      analysisJobId: null,
    },
    widthMm: 1140,
    lengthMm: 2700,
  };
  input.measurements = [
    {
      name: "bust",
      kind: "body",
      valueMm: 920,
      enteredValue: "92",
      enteredUnit: "cm",
      source: "customer_manual",
      sourceAssetId: null,
      recordedAt: null,
    },
  ];
  input.selectedConceptAssetId = "ast_concept";
  return input;
}

async function seedProject(db: InMemoryDb, subject = "user_a") {
  const { userId } = await ensureLocalUser(db, actor(subject));
  const { detail } = await createProject(db, userId, KEY(`create-${subject}`), {
    title: "Test dress",
    template: { id: "tpl_test", version: 1 },
    occasion: null,
    deadline: null,
    fit: "regular",
    timezone: "Africa/Accra",
  });
  return { userId, projectId: detail.project.id };
}

async function seedRevision(db: InMemoryDb, userId: string, projectId: string) {
  await insertAsset(db, {
    id: "ast_crop",
    projectId,
    ownerUserId: userId,
    kind: "fabric_crop",
    mime: "image/jpeg",
    bytes: 10,
    widthPx: 10,
    heightPx: 10,
  });
  await insertAsset(db, {
    id: "ast_concept",
    projectId,
    ownerUserId: userId,
    kind: "concept",
    mime: "image/png",
    bytes: 10,
    widthPx: 10,
    heightPx: 10,
  });
  const saved = await saveDraft(db, userId, projectId, {
    expectedDraftVersion: 1,
    input: completeInput(),
  });
  const frozen = await freezeRevision(db, userId, projectId, KEY("freeze"), {
    expectedDraftVersion: saved.draftVersion,
    expectedProjectVersion: saved.projectVersion,
  });
  return frozen.revision.id;
}

async function insertJob(
  db: InMemoryDb,
  opts: {
    id: string;
    ownerUserId: string;
    projectId: string;
    revisionId: string;
    type: string;
    state: string;
    createdAt: number;
    resultJson?: string | null;
  },
) {
  await db
    .prepare(
      "INSERT INTO ai_jobs (id, owner_user_id, project_id, revision_id, type, idempotency_key, request_hash, state, stage, attempt_count, workflow_id, result_json, error_code, retryable, reserved_credits, cancel_requested_at, deadline_at, created_at, updated_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      opts.id,
      opts.ownerUserId,
      opts.projectId,
      opts.revisionId,
      opts.type,
      `idem-${opts.id}`,
      "hash",
      opts.state,
      null,
      0,
      null,
      opts.resultJson ?? null,
      null,
      0,
      0,
      null,
      opts.createdAt + 900_000,
      opts.createdAt,
      opts.createdAt,
      opts.state === "completed" ? opts.createdAt : null,
    )
    .run();
}

describe("getProjectDetail latestJob", () => {
  it("is null when the project has no jobs, and the detail parses the contract", async () => {
    const db = await makeDb();
    const { userId, projectId } = await seedProject(db);
    const detail = await getProjectDetail(db, userId, projectId);
    expect(detail.latestJob).toBeNull();
    expect(projectDetailSchema.parse(detail).latestJob).toBeNull();
  });

  it("returns the newest owner job when several exist, ignoring other owners' jobs", async () => {
    const db = await makeDb();
    const { userId, projectId } = await seedProject(db);
    const { userId: otherId } = await ensureLocalUser(db, actor("user_b"));
    const revisionId = await seedRevision(db, userId, projectId);
    await insertJob(db, {
      id: "job_old",
      ownerUserId: userId,
      projectId,
      revisionId,
      type: "assemble_brief",
      state: "completed",
      createdAt: BASE,
      resultJson: JSON.stringify({ type: "assemble_brief", briefId: "brf_draft_1" }),
    });
    await insertJob(db, {
      id: "job_new",
      ownerUserId: userId,
      projectId,
      revisionId,
      type: "generate_concept",
      state: "queued",
      createdAt: BASE + 1_000,
    });
    await insertJob(db, {
      id: "job_other_owner",
      ownerUserId: otherId,
      projectId,
      revisionId,
      type: "analyze_fabric",
      state: "running",
      createdAt: BASE + 2_000,
    });
    const detail = await getProjectDetail(db, userId, projectId);
    expect(detail.latestJob?.id).toBe("job_new");
    expect(detail.latestJob?.state).toBe("queued");
    const parsed = projectDetailSchema.parse(detail);
    expect(parsed.latestJob?.id).toBe("job_new");
    // The completed assemble_brief result (draft brief id) stays reachable on its own job row.
    const history = await getProjectHistory(db, userId, projectId);
    expect(history.items.some((i) => i.kind === "job" && i.id === "job_old")).toBe(true);
  });

  it("stays owner-scoped: another user's detail request is NOT_FOUND", async () => {
    const db = await makeDb();
    const { projectId } = await seedProject(db);
    const { userId: otherId } = await ensureLocalUser(db, actor("user_b"));
    await expect(getProjectDetail(db, otherId, projectId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("getProjectHistory", () => {
  it("returns contract-shaped revision, brief, job and review items, newest first", async () => {
    const db = await makeDb();
    const { userId, projectId } = await seedProject(db);
    const revisionId = await seedRevision(db, userId, projectId);
    const brief = await assembleBrief(db, userId, projectId, revisionId);
    await insertJob(db, {
      id: "job_hist_1",
      ownerUserId: userId,
      projectId,
      revisionId,
      type: "analyze_fabric",
      state: "completed",
      createdAt: BASE,
      resultJson: JSON.stringify({
        type: "analyze_fabric",
        sourceAssetId: "ast_src",
        segmentation: { status: "completed", regions: [], errorCode: null },
        observations: [],
      }),
    });
    await db
      .prepare(
        "INSERT INTO review_actions (id, brief_id, grant_id, session_id, action, expected_content_hash, reviewer_name, credential_type, reviewer_user_id, note, idempotency_key, request_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "rva_hist_1",
        brief.id,
        "grant_hist_1",
        "sess_hist_1",
        "approve_design",
        brief.contentHash,
        "Reviewer One",
        "possession_link",
        null,
        null,
        "rva-idem-1",
        "hash",
        BASE + 5_000,
      )
      .run();

    const history = await getProjectHistory(db, userId, projectId);
    const parsed = historyListSchema.parse(history);
    const kinds = parsed.items.map((i) => i.kind).sort();
    expect(kinds).toEqual(["brief", "job", "review", "revision"]);
    expect(parsed.nextCursor).toBeNull();

    const revision = parsed.items.find((i) => i.kind === "revision")!;
    expect(revision).toMatchObject({
      id: revisionId,
      summary: "Input revision 1 saved",
      revisionId,
    });
    const briefItem = parsed.items.find((i) => i.kind === "brief")!;
    expect(briefItem).toMatchObject({
      id: brief.id,
      summary: `Brief ${brief.briefNumber} ${brief.state}`,
      briefId: brief.id,
      status: brief.state,
    });
    const job = parsed.items.find((i) => i.kind === "job")!;
    expect(job).toMatchObject({
      id: "job_hist_1",
      summary: "Job analyze_fabric completed",
      revisionId,
      status: "completed",
    });
    const review = parsed.items.find((i) => i.kind === "review")!;
    expect(review).toMatchObject({
      id: "rva_hist_1",
      summary: "Review approve_design by Reviewer One",
      briefId: brief.id,
      status: "approve_design",
    });
    const stamps = parsed.items.map((i) => Date.parse(i.createdAt));
    expect(stamps).toEqual([...stamps].sort((a, b) => b - a));
  });

  it("returns an empty, contract-shaped page for a project with no history", async () => {
    const db = await makeDb();
    const { userId, projectId } = await seedProject(db);
    const history = await getProjectHistory(db, userId, projectId);
    expect(historyListSchema.parse(history)).toEqual({ items: [], nextCursor: null });
  });

  it("paginates with an opaque cursor and rejects invalid cursors", async () => {
    const db = await makeDb();
    const { userId, projectId } = await seedProject(db);
    const revisionId = await seedRevision(db, userId, projectId);
    await insertJob(db, {
      id: "job_page_1",
      ownerUserId: userId,
      projectId,
      revisionId,
      type: "analyze_fabric",
      state: "queued",
      createdAt: BASE,
    });
    const first = historyListSchema.parse(
      await getProjectHistory(db, userId, projectId, { limit: 1 }),
    );
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).not.toBeNull();
    const second = historyListSchema.parse(
      await getProjectHistory(db, userId, projectId, { limit: 1, cursor: first.nextCursor! }),
    );
    expect(second.items).toHaveLength(1);
    expect(second.items[0]!.id).not.toBe(first.items[0]!.id);
    expect(second.nextCursor).toBeNull();
    await expect(
      getProjectHistory(db, userId, projectId, { cursor: "not-a-cursor" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("history HTTP handler", () => {
  function makeHandlers(db: InMemoryDb) {
    return createTailorHandlers({
      db,
      verifier: async (request) => {
        const m = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
        if (!m?.[1]) return null;
        return { subject: m[1], displayName: m[1], email: `${m[1]}@example.invalid` };
      },
    });
  }
  const getReq = (subject: string, url = "http://test/api/tailor/projects/x/history") =>
    new Request(url, { headers: { authorization: `Bearer ${subject}` } });

  it("serves the owner's history and 404s for a cross-owner project (F13)", async () => {
    const db = await makeDb();
    const handlers = makeHandlers(db);
    const { userId, projectId } = await seedProject(db);
    const revisionId = await seedRevision(db, userId, projectId);
    await insertJob(db, {
      id: "job_http_1",
      ownerUserId: userId,
      projectId,
      revisionId,
      type: "generate_concept",
      state: "running",
      createdAt: BASE,
    });
    const ok = await handlers.projectHistory(getReq("user_a"), projectId);
    expect(ok.status).toBe(200);
    const body = await ok.json();
    const parsed = historyListSchema.parse(body.data);
    expect(parsed.items.map((i) => i.kind).sort()).toEqual(["job", "revision"]);

    const cross = await handlers.projectHistory(getReq("user_b"), projectId);
    expect(cross.status).toBe(404);
    expect((await cross.json()).error.code).toBe("NOT_FOUND");
  });
});
