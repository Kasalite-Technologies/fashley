import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDb } from "./db";
import { InMemoryMediaStore } from "./media";
import { ensureLocalUser } from "./identity";
import { createProject, freezeRevision, insertAsset, saveDraft } from "./projects";
import { pilotGrant } from "./credits";
import { defaultConfig, type MetaAdapter, type TailorConfig, type WorkflowAdapter } from "./config";
import { createBriefJob, createJob, getJobForUser, runJob } from "./jobs";
import { base64ToBytes, createMetaAdapter } from "./meta";
import { emptyProjectInput, type ProjectInput } from "../contracts";

const MIGRATIONS = readdirSync(join(process.cwd(), "migrations/tailor"))
  .sort()
  .map((f) => readFileSync(join(process.cwd(), "migrations/tailor", f), "utf8"));
async function makeDb() {
  const db = new InMemoryDb();
  for (const sql of MIGRATIONS) await db.exec(sql);
  return db;
}
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const KEY = (n: string) => `test-key-${n}-1234567890`;
const config: TailorConfig = {
  ...defaultConfig,
  jobQuotes: { analyze_fabric: 5, generate_concept: 5, assemble_brief: 0 },
};

async function seedTemplate(db: InMemoryDb) {
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
}
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
async function seedProject(db: InMemoryDb) {
  await seedTemplate(db);
  const { userId } = await ensureLocalUser(db, {
    subject: "user_a",
    displayName: "user_a",
    email: "user_a@example.invalid",
  });
  await pilotGrant(db, userId, 100, "grant-1");
  const { detail } = await createProject(db, userId, KEY("create"), {
    title: "Test dress",
    template: { id: "tpl_test", version: 1 },
    occasion: null,
    deadline: null,
    fit: "regular",
    timezone: "Africa/Accra",
  });
  const projectId = detail.project.id;
  await insertAsset(db, {
    id: "ast_src",
    projectId,
    ownerUserId: userId,
    kind: "fabric_source",
    mime: "image/png",
    bytes: 10,
    widthPx: 1,
    heightPx: 1,
  });
  await insertAsset(db, {
    id: "ast_crop",
    projectId,
    ownerUserId: userId,
    kind: "fabric_crop",
    mime: "image/png",
    bytes: 10,
    widthPx: 1,
    heightPx: 1,
  });
  await insertAsset(db, {
    id: "ast_concept",
    projectId,
    ownerUserId: userId,
    kind: "concept",
    mime: "image/png",
    bytes: 10,
    widthPx: 1,
    heightPx: 1,
  });
  const saved = await saveDraft(db, userId, projectId, {
    expectedDraftVersion: 1,
    input: completeInput(),
  });
  const frozen = await freezeRevision(db, userId, projectId, KEY("freeze"), {
    expectedDraftVersion: saved.draftVersion,
    expectedProjectVersion: saved.projectVersion,
  });
  return { userId, projectId, revisionId: frozen.revision.id };
}
function fakeWorkflow() {
  const dispatched: string[] = [];
  const workflow: WorkflowAdapter = {
    dispatch: async (jobId: string) => {
      dispatched.push(jobId);
      return { workflowId: `wf_${jobId}` };
    },
  };
  return { workflow, dispatched };
}
const unusedMeta = (over: Partial<MetaAdapter>): MetaAdapter => ({
  segmentFabric: async () => {
    throw new Error("unused");
  },
  understandFabric: async () => {
    throw new Error("unused");
  },
  generateConcept: async () => {
    throw new Error("unused");
  },
  assembleBrief: async () => {
    throw new Error("unused");
  },
  ...over,
});

describe("createJob", () => {
  it("fails FEATURE_UNAVAILABLE without a workflow and inserts no row", async () => {
    const db = await makeDb();
    const ctx = await seedProject(db);
    await expect(
      createJob(db, { config }, ctx.userId, ctx.projectId, KEY("job1"), {
        type: "analyze_fabric",
        revisionId: ctx.revisionId,
      }),
    ).rejects.toMatchObject({ code: "FEATURE_UNAVAILABLE" });
    expect(await db.prepare("SELECT * FROM ai_jobs").first()).toBeNull();
  });

  it("queues with workflow id, reserves credits, and replays idempotently", async () => {
    const db = await makeDb();
    const ctx = await seedProject(db);
    const { workflow, dispatched } = fakeWorkflow();
    const first = await createJob(
      db,
      { workflow, config },
      ctx.userId,
      ctx.projectId,
      KEY("job2"),
      {
        type: "analyze_fabric",
        revisionId: ctx.revisionId,
      },
    );
    expect(first.job.state).toBe("queued");
    expect(first.credits.reserved).toBe(5);
    const row = await db
      .prepare("SELECT * FROM ai_jobs WHERE id = ?")
      .bind(first.job.id)
      .first<{ workflow_id: string; state: string }>();
    expect(row!.workflow_id).toBe(`wf_${first.job.id}`);
    const replay = await createJob(
      db,
      { workflow, config },
      ctx.userId,
      ctx.projectId,
      KEY("job2"),
      {
        type: "analyze_fabric",
        revisionId: ctx.revisionId,
      },
    );
    expect(replay.job.id).toBe(first.job.id);
    expect(replay.credits.reserved).toBe(5);
    expect(dispatched).toEqual([first.job.id]);
  });
});

describe("runJob", () => {
  it("completes assemble_brief without meta/media", async () => {
    const db = await makeDb();
    const ctx = await seedProject(db);
    const { workflow } = fakeWorkflow();
    const { job } = await createBriefJob(
      db,
      { workflow, config },
      ctx.userId,
      ctx.projectId,
      KEY("brief"),
      ctx.revisionId,
    );
    await runJob(db, {}, job.id);
    const done = await getJobForUser(db, ctx.userId, job.id);
    expect(done.state).toBe("completed");
    expect(done.result?.type).toBe("assemble_brief");
    if (done.result?.type === "assemble_brief")
      expect(
        await db
          .prepare("SELECT * FROM brief_revisions WHERE id = ?")
          .bind(done.result.briefId)
          .first(),
      ).toBeTruthy();
  });

  it("completes analyze_fabric, stores mask assets and observations", async () => {
    const db = await makeDb();
    const ctx = await seedProject(db);
    const media = new InMemoryMediaStore();
    await media.putPrivate(`private/${ctx.projectId}/ast_src`, base64ToBytes(PNG_B64));
    const meta = unusedMeta({
      segmentFabric: async (input) => {
        expect((input as { imageDataUrl: string }).imageDataUrl).toContain(
          "data:image/png;base64,",
        );
        return {
          providerRequestId: "seg_1",
          outputText: JSON.stringify({
            regions: [
              { id: "r1", bbox: { x: 0, y: 0, width: 0.5, height: 0.5 }, maskBase64: PNG_B64 },
            ],
          }),
        };
      },
      understandFabric: async () => ({
        providerRequestId: "und_1",
        outputText: JSON.stringify([{ key: "color", value: "indigo", uncertainty: "observed" }]),
      }),
    });
    const { workflow } = fakeWorkflow();
    const { job } = await createJob(
      db,
      { workflow, config },
      ctx.userId,
      ctx.projectId,
      KEY("analyze"),
      {
        type: "analyze_fabric",
        revisionId: ctx.revisionId,
      },
    );
    await runJob(db, { meta, media, config }, job.id);
    const done = await getJobForUser(db, ctx.userId, job.id);
    expect(done.state).toBe("completed");
    expect(done.result?.type).toBe("analyze_fabric");
    if (done.result?.type === "analyze_fabric") {
      expect(done.result.segmentation.regions).toHaveLength(1);
      const maskId = done.result.segmentation.regions[0]!.maskAssetId;
      const mask = await db
        .prepare("SELECT * FROM assets WHERE id = ?")
        .bind(maskId)
        .first<{ kind: string; parent_asset_id: string }>();
      expect(mask).toMatchObject({ kind: "fabric_mask", parent_asset_id: "ast_src" });
      expect(media.objects.has(`private/${ctx.projectId}/${maskId}`)).toBe(true);
      expect(done.result.observations).toEqual([
        { key: "color", value: "indigo", uncertainty: "observed" },
      ]);
    }
  });

  it("fails analyze_fabric on garbage segmentation and releases credits", async () => {
    const db = await makeDb();
    const ctx = await seedProject(db);
    const media = new InMemoryMediaStore();
    await media.putPrivate(`private/${ctx.projectId}/ast_src`, base64ToBytes(PNG_B64));
    const meta = unusedMeta({
      segmentFabric: async () => ({ providerRequestId: "seg_1", outputText: "not json at all" }),
    });
    const { workflow } = fakeWorkflow();
    const { job } = await createJob(
      db,
      { workflow, config },
      ctx.userId,
      ctx.projectId,
      KEY("garbage"),
      {
        type: "analyze_fabric",
        revisionId: ctx.revisionId,
      },
    );
    await runJob(db, { meta, media, config }, job.id);
    const done = await getJobForUser(db, ctx.userId, job.id);
    expect(done.state).toBe("failed");
    expect(done.error?.code).toBe("PROVIDER_UNAVAILABLE");
    const stepRun = await db
      .prepare("SELECT * FROM ai_step_runs WHERE job_id = ? AND step_key = ?")
      .bind(job.id, "segment_fabric")
      .first<{ state: string; output_json: string }>();
    expect(stepRun!.state).toBe("failed");
    const stepOutput = JSON.parse(stepRun!.output_json) as {
      errorCode: string;
      diagnostic?: Record<string, unknown>;
    };
    expect(stepOutput.errorCode).toBe("PROVIDER_UNAVAILABLE");
    expect(stepOutput.diagnostic).toMatchObject({
      providerStatus: null,
      failureKind: "unparseable_output",
    });
    const reservation = await db
      .prepare("SELECT * FROM credit_reservations WHERE job_id = ?")
      .bind(job.id)
      .first<{ state: string }>();
    expect(reservation!.state).toBe("released");
  });

  it("persists redacted provider diagnostic on step run for HTTP 401, public error stays PROVIDER_UNAVAILABLE", async () => {
    const db = await makeDb();
    const ctx = await seedProject(db);
    const media = new InMemoryMediaStore();
    await media.putPrivate(`private/${ctx.projectId}/ast_src`, base64ToBytes(PNG_B64));
    const providerBody = JSON.stringify({
      error: {
        code: "invalid_api_key",
        message: `Invalid API key test-secret-key ${"word ".repeat(100)}ENDMARKER`,
      },
    });
    const fetchFn = (async () => new Response(providerBody, { status: 401 })) as typeof fetch;
    const meta = createMetaAdapter(async () => "test-secret-key", fetchFn) as MetaAdapter;
    const { workflow } = fakeWorkflow();
    const { job } = await createJob(
      db,
      { workflow, config },
      ctx.userId,
      ctx.projectId,
      KEY("provider401"),
      { type: "analyze_fabric", revisionId: ctx.revisionId },
    );
    await runJob(db, { meta, media, config }, job.id);
    const done = await getJobForUser(db, ctx.userId, job.id);
    expect(done.state).toBe("failed");
    expect(done.error?.code).toBe("PROVIDER_UNAVAILABLE");
    const stepRun = await db
      .prepare("SELECT * FROM ai_step_runs WHERE job_id = ? AND step_key = ?")
      .bind(job.id, "segment_fabric")
      .first<{ state: string; output_json: string }>();
    expect(stepRun!.state).toBe("failed");
    expect(stepRun!.output_json).not.toContain("test-secret-key");
    expect(stepRun!.output_json).not.toContain(providerBody);
    expect(stepRun!.output_json).not.toContain("ENDMARKER");
    const stepOutput = JSON.parse(stepRun!.output_json) as {
      errorCode: string;
      diagnostic?: {
        providerStatus: number | null;
        failureKind: string;
        providerErrorCode: string | null;
        providerErrorMessage: string | null;
      };
    };
    expect(stepOutput.errorCode).toBe("PROVIDER_UNAVAILABLE");
    expect(stepOutput.diagnostic).toMatchObject({
      providerStatus: 401,
      failureKind: "http_error",
      providerErrorCode: "invalid_api_key",
    });
    expect(stepOutput.diagnostic!.providerErrorMessage!.length).toBeLessThanOrEqual(200);
  });

  it("persists diagnostic for provider HTTP 200 with non-JSON output", async () => {
    const db = await makeDb();
    const ctx = await seedProject(db);
    const media = new InMemoryMediaStore();
    await media.putPrivate(`private/${ctx.projectId}/ast_src`, base64ToBytes(PNG_B64));
    const fetchFn = (async () =>
      new Response("prose response, not json", { status: 200 })) as typeof fetch;
    const meta = createMetaAdapter(async () => "test-secret-key", fetchFn) as MetaAdapter;
    const { workflow } = fakeWorkflow();
    const { job } = await createJob(
      db,
      { workflow, config },
      ctx.userId,
      ctx.projectId,
      KEY("provider200prose"),
      { type: "analyze_fabric", revisionId: ctx.revisionId },
    );
    await runJob(db, { meta, media, config }, job.id);
    const done = await getJobForUser(db, ctx.userId, job.id);
    expect(done.state).toBe("failed");
    expect(done.error?.code).toBe("PROVIDER_UNAVAILABLE");
    const stepRun = await db
      .prepare("SELECT * FROM ai_step_runs WHERE job_id = ? AND step_key = ?")
      .bind(job.id, "segment_fabric")
      .first<{ output_json: string }>();
    const stepOutput = JSON.parse(stepRun!.output_json) as { diagnostic?: unknown };
    expect(stepOutput.diagnostic).toMatchObject({
      providerStatus: 200,
      failureKind: "non_json_response",
    });
  });

  it("sends segmentation request asking for the contracted JSON shape", async () => {
    const db = await makeDb();
    const ctx = await seedProject(db);
    const media = new InMemoryMediaStore();
    await media.putPrivate(`private/${ctx.projectId}/ast_src`, base64ToBytes(PNG_B64));
    const requestBodies: Record<string, unknown>[] = [];
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
      const sent = JSON.parse(String(init!.body)) as Record<string, unknown>;
      requestBodies.push(sent);
      if (sent["model"] === "sam-3.1") {
        return new Response(
          JSON.stringify({
            id: "seg_1",
            output_text: JSON.stringify({
              regions: [
                { id: "r1", bbox: { x: 0, y: 0, width: 0.5, height: 0.5 }, maskBase64: PNG_B64 },
              ],
            }),
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          id: "und_1",
          output_text: JSON.stringify([{ key: "color", value: "indigo", uncertainty: "observed" }]),
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const meta = createMetaAdapter(async () => "test-secret-key", fetchFn) as MetaAdapter;
    const { workflow } = fakeWorkflow();
    const { job } = await createJob(
      db,
      { workflow, config },
      ctx.userId,
      ctx.projectId,
      KEY("segmentprompt"),
      { type: "analyze_fabric", revisionId: ctx.revisionId },
    );
    await runJob(db, { meta, media, config }, job.id);
    const done = await getJobForUser(db, ctx.userId, job.id);
    expect(done.state).toBe("completed");
    const segmentRequest = requestBodies.find((b) => b["model"] === "sam-3.1")!;
    const serialized = JSON.stringify(segmentRequest);
    expect(serialized).toContain("regions");
    expect(serialized).toContain("maskBase64");
    expect(serialized).toContain("base64-encoded PNG or JPEG mask image");
    expect(serialized).toContain("bbox");
    expect(serialized).toContain("normalized");
    expect(serialized).not.toContain("test-secret-key");
  });

  it("completes generate_concept and stores the concept asset", async () => {
    const db = await makeDb();
    const ctx = await seedProject(db);
    const media = new InMemoryMediaStore();
    await media.putPrivate(`private/${ctx.projectId}/ast_crop`, base64ToBytes(PNG_B64));
    const meta = unusedMeta({
      generateConcept: async (input) => {
        expect((input as { prompt: string }).prompt).toContain("tpl_test");
        return { providerRequestId: "gen_1", modelId: "muse-image-1.0", imageBase64: PNG_B64 };
      },
    });
    const { workflow } = fakeWorkflow();
    const { job } = await createJob(
      db,
      { workflow, config },
      ctx.userId,
      ctx.projectId,
      KEY("gen"),
      {
        type: "generate_concept",
        revisionId: ctx.revisionId,
      },
    );
    await runJob(db, { meta, media, config }, job.id);
    const done = await getJobForUser(db, ctx.userId, job.id);
    expect(done.state).toBe("completed");
    expect(done.result?.type).toBe("generate_concept");
    if (done.result?.type === "generate_concept") {
      expect(done.result.modelId).toBe("muse-image-1.0");
      expect(done.result.providerRequestId).toBe("gen_1");
      const asset = await db
        .prepare("SELECT * FROM assets WHERE id = ?")
        .bind(done.result.asset.id)
        .first<{ kind: string; origin_job_id: string }>();
      expect(asset).toMatchObject({ kind: "concept", origin_job_id: job.id });
      expect(media.objects.has(`private/${ctx.projectId}/${done.result.asset.id}`)).toBe(true);
    }
  });
});
