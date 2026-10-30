import type { Db } from "./db";
import {
  defaultConfig,
  type MetaAdapter,
  type MediaStore,
  type TailorConfig,
  type WorkflowAdapter,
} from "./config";
import { err, newId, notFound, TailorError } from "./errors";
import { hashPayload, nowMs, toIso } from "./util";
import { getRevision } from "./projects";
import { assembleBrief } from "./briefs";
import { reserveCredits, settleCredits } from "./credits";
import { sanitizeImage } from "./media";
import {
  base64ToBytes,
  bytesToDataUrl,
  META_MODELS,
  META_PROMPT_VERSIONS,
  type MetaGenerateResult,
  type MetaSegmentResult,
} from "./meta";
import { jobResultSchema, type Asset, type Job, type JobResult } from "../contracts";

export interface JobRow {
  id: string;
  owner_user_id: string;
  project_id: string;
  revision_id: string;
  type: string;
  idempotency_key: string;
  request_hash: string;
  state: string;
  stage: string | null;
  attempt_count: number;
  workflow_id: string | null;
  result_json: string | null;
  error_code: string | null;
  retryable: number;
  reserved_credits: number;
  cancel_requested_at: number | null;
  deadline_at: number;
  created_at: number;
  updated_at: number;
  finished_at: number | null;
}

export function toJob(row: JobRow): Job {
  let result: JobResult | null = null;
  if (row.result_json) {
    try {
      result = JSON.parse(row.result_json) as JobResult;
    } catch {
      result = null;
    }
  }
  return {
    id: row.id,
    projectId: row.project_id,
    revisionId: row.revision_id,
    type: row.type as Job["type"],
    state: row.state as Job["state"],
    stage: row.stage as Job["stage"],
    attemptCount: row.attempt_count,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    retryAfterMs: null,
    result,
    error: row.error_code
      ? {
          code: row.error_code,
          message: row.state === "cancelled" ? "Job was cancelled." : "Job failed.",
          retryable: row.retryable === 1,
        }
      : null,
  };
}

export interface JobDeps {
  workflow?: WorkflowAdapter;
  meta?: MetaAdapter;
  media?: MediaStore;
  config?: TailorConfig;
}

interface AssetRow {
  id: string;
  project_id: string;
  owner_user_id: string;
  kind: string;
  object_key: string;
  mime: string;
  bytes: number;
  width_px: number;
  height_px: number;
  sha256: string;
  parent_asset_id: string | null;
  consent_id: string | null;
  origin_job_id: string | null;
  state: string;
  retention_expires_at: number | null;
  created_at: number;
  updated_at: number;
}
function toAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind,
    mime: row.mime as Asset["mime"],
    bytes: row.bytes,
    widthPx: row.width_px,
    heightPx: row.height_px,
    parentAssetId: row.parent_asset_id,
    createdAt: toIso(row.created_at),
  };
}

const TERMINAL = new Set(["completed", "failed", "cancelled"]);
const JOB_DEADLINE_MS = 15 * 60 * 1000;

async function getJobRow(db: Db, jobId: string): Promise<JobRow | null> {
  return db.prepare("SELECT * FROM ai_jobs WHERE id = ?").bind(jobId).first<JobRow>();
}
async function getOwnedJobRow(db: Db, userId: string, jobId: string): Promise<JobRow> {
  const row = await db
    .prepare("SELECT * FROM ai_jobs WHERE id = ? AND owner_user_id = ?")
    .bind(jobId, userId)
    .first<JobRow>();
  if (!row) throw notFound();
  return row;
}
async function updateJob(db: Db, jobId: string, sets: [string, unknown][]): Promise<void> {
  const sql = `UPDATE ai_jobs SET ${sets.map(([c]) => `${c} = ?`).join(", ")} WHERE id = ?`;
  await db
    .prepare(sql)
    .bind(...sets.map(([, v]) => v), jobId)
    .run();
}
async function settleQuietly(db: Db, userId: string, jobId: string, outcome: "debit" | "release") {
  await settleCredits(db, { userId, jobId, outcome }).catch(() => undefined);
}

type JobType = "analyze_fabric" | "generate_concept" | "assemble_brief";

async function createJobInternal(
  db: Db,
  deps: JobDeps,
  userId: string,
  projectId: string,
  idempotencyKey: string,
  req: { type: JobType; revisionId: string },
): Promise<{ job: Job; credits: { reserved: number } }> {
  if (!deps.workflow) throw err("FEATURE_UNAVAILABLE", "Workflow binding is not configured.");
  const config = deps.config ?? defaultConfig;
  await getRevision(db, userId, projectId, req.revisionId);
  const requestHash = await hashPayload({ projectId, ...req });
  const existing = await db
    .prepare("SELECT * FROM ai_jobs WHERE owner_user_id = ? AND idempotency_key = ?")
    .bind(userId, idempotencyKey)
    .first<JobRow>();
  if (existing) {
    if (existing.request_hash !== requestHash)
      throw err("IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different request.");
    return { job: toJob(existing), credits: { reserved: existing.reserved_credits } };
  }
  const quote = config.jobQuotes[req.type];
  const jobId = newId("job");
  const now = nowMs();
  await db
    .prepare(
      "INSERT INTO ai_jobs (id, owner_user_id, project_id, revision_id, type, idempotency_key, request_hash, state, stage, attempt_count, workflow_id, result_json, error_code, retryable, reserved_credits, cancel_requested_at, deadline_at, created_at, updated_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      jobId,
      userId,
      projectId,
      req.revisionId,
      req.type,
      idempotencyKey,
      requestHash,
      "queued",
      null,
      0,
      null,
      null,
      null,
      0,
      quote,
      null,
      now + JOB_DEADLINE_MS,
      now,
      now,
      null,
    )
    .run();
  try {
    await reserveCredits(db, { userId, jobId, amount: quote });
  } catch (e) {
    if (e instanceof TailorError && e.code === "BUDGET_EXCEEDED") {
      await updateJob(db, jobId, [
        ["state", "failed"],
        ["error_code", "BUDGET_EXCEEDED"],
        ["retryable", 0],
        ["finished_at", nowMs()],
        ["updated_at", nowMs()],
      ]);
    }
    throw e;
  }
  let workflowId: string;
  try {
    workflowId = (await deps.workflow.dispatch(jobId)).workflowId;
  } catch {
    await settleQuietly(db, userId, jobId, "release");
    await updateJob(db, jobId, [
      ["state", "failed"],
      ["error_code", "FEATURE_UNAVAILABLE"],
      ["retryable", 1],
      ["finished_at", nowMs()],
      ["updated_at", nowMs()],
    ]);
    throw err("FEATURE_UNAVAILABLE", "Workflow binding is not configured.");
  }
  await updateJob(db, jobId, [
    ["workflow_id", workflowId],
    ["updated_at", nowMs()],
  ]);
  return { job: toJob((await getJobRow(db, jobId))!), credits: { reserved: quote } };
}

export async function createJob(
  db: Db,
  deps: JobDeps,
  userId: string,
  projectId: string,
  idempotencyKey: string,
  req: { type: "analyze_fabric" | "generate_concept"; revisionId: string },
): Promise<{ job: Job; credits: { reserved: number } }> {
  return createJobInternal(db, deps, userId, projectId, idempotencyKey, req);
}

export async function createBriefJob(
  db: Db,
  deps: JobDeps,
  userId: string,
  projectId: string,
  idempotencyKey: string,
  revisionId: string,
): Promise<{ job: Job }> {
  const { job } = await createJobInternal(db, deps, userId, projectId, idempotencyKey, {
    type: "assemble_brief",
    revisionId,
  });
  return { job };
}

export async function getJobForUser(db: Db, userId: string, jobId: string): Promise<Job> {
  return toJob(await getOwnedJobRow(db, userId, jobId));
}

export async function cancelJob(db: Db, userId: string, jobId: string): Promise<Job> {
  const row = await getOwnedJobRow(db, userId, jobId);
  if (row.state !== "queued" && row.state !== "running" && row.state !== "retry_wait")
    return toJob(row);
  const now = nowMs();
  await updateJob(db, jobId, [
    ["state", "cancelled"],
    ["cancel_requested_at", now],
    ["finished_at", now],
    ["updated_at", now],
  ]);
  await settleQuietly(db, userId, jobId, "release");
  return toJob((await getJobRow(db, jobId))!);
}

export async function retryJob(db: Db, deps: JobDeps, userId: string, jobId: string): Promise<Job> {
  const row = await getOwnedJobRow(db, userId, jobId);
  if (row.state !== "failed" && row.state !== "cancelled")
    throw err("JOB_NOT_RETRYABLE", "Only a failed or cancelled job can be retried.");
  if (!deps.workflow) throw err("FEATURE_UNAVAILABLE", "Workflow binding is not configured.");
  await db
    .prepare(
      "UPDATE ai_jobs SET state = ?, error_code = ?, retryable = ?, finished_at = ?, attempt_count = attempt_count + 1, updated_at = ? WHERE id = ?",
    )
    .bind("queued", null, 0, null, nowMs(), jobId)
    .run();
  if (row.reserved_credits > 0) {
    const reservation = await db
      .prepare("SELECT * FROM credit_reservations WHERE job_id = ?")
      .bind(jobId)
      .first<{ state: string }>();
    // Known limitation: reserveCredits replays an existing terminal reservation without
    // re-holding, so a retry after release/debit cannot restore the original hold.
    if (reservation?.state !== "held")
      await reserveCredits(db, { userId, jobId, amount: row.reserved_credits }).catch(
        () => undefined,
      );
  }
  try {
    const { workflowId } = await deps.workflow.dispatch(jobId);
    await updateJob(db, jobId, [
      ["workflow_id", workflowId],
      ["updated_at", nowMs()],
    ]);
  } catch (e) {
    await settleQuietly(db, userId, jobId, "release");
    const code = e instanceof TailorError ? e.code : "FEATURE_UNAVAILABLE";
    await updateJob(db, jobId, [
      ["state", "failed"],
      ["error_code", code],
      ["retryable", 1],
      ["finished_at", nowMs()],
      ["updated_at", nowMs()],
    ]);
    throw e;
  }
  return toJob((await getJobRow(db, jobId))!);
}

function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}
function stripFence(text: string): string {
  const t = text.trim();
  if (!t.startsWith("```")) return t;
  return t
    .replace(/^```[a-zA-Z]*\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}
function stepOutputJson(value: unknown): string {
  let s: string;
  try {
    s = JSON.stringify(value) ?? "null";
  } catch {
    s = "null";
  }
  return s.length <= 2000 ? s : JSON.stringify({ truncated: s.slice(0, 1900) });
}
const providerUnavailable = () => err("PROVIDER_UNAVAILABLE", "Meta provider is unavailable.");

async function insertDerivedAsset(
  db: Db,
  input: {
    id: string;
    projectId: string;
    ownerUserId: string;
    kind: string;
    mime: string;
    bytes: number;
    widthPx: number;
    heightPx: number;
    sha256: string;
    parentAssetId: string | null;
    originJobId: string;
  },
): Promise<AssetRow> {
  const now = nowMs();
  const objectKey = `private/${input.projectId}/${input.id}`;
  await db
    .prepare(
      "INSERT INTO assets (id, project_id, owner_user_id, kind, object_key, mime, bytes, width_px, height_px, sha256, parent_asset_id, consent_id, origin_job_id, state, retention_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      input.id,
      input.projectId,
      input.ownerUserId,
      input.kind,
      objectKey,
      input.mime,
      input.bytes,
      input.widthPx,
      input.heightPx,
      input.sha256,
      input.parentAssetId,
      null,
      input.originJobId,
      "ready",
      null,
      now,
      now,
    )
    .run();
  return (await db.prepare("SELECT * FROM assets WHERE id = ?").bind(input.id).first<AssetRow>())!;
}

interface RegionInput {
  id: string;
  bbox: { x: number; y: number; width: number; height: number };
  maskBase64?: string;
}
function parseRegions(outputText: string): RegionInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(outputText));
  } catch {
    throw providerUnavailable();
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw providerUnavailable();
  const regions = (parsed as { regions?: unknown }).regions;
  if (!Array.isArray(regions) || regions.length === 0) throw providerUnavailable();
  return regions.map((r) => {
    if (typeof r !== "object" || r === null) throw providerUnavailable();
    const rec = r as Record<string, unknown>;
    const bbox = rec["bbox"] as Record<string, unknown> | null;
    if (typeof rec["id"] !== "string" || !rec["id"] || !bbox || typeof bbox !== "object")
      throw providerUnavailable();
    const nums = [bbox["x"], bbox["y"], bbox["width"], bbox["height"]];
    if (nums.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1))
      throw providerUnavailable();
    if (Number(bbox["width"]) <= 0 || Number(bbox["height"]) <= 0) throw providerUnavailable();
    if (rec["maskBase64"] !== undefined && typeof rec["maskBase64"] !== "string")
      throw providerUnavailable();
    return {
      id: rec["id"],
      bbox: {
        x: Number(bbox["x"]),
        y: Number(bbox["y"]),
        width: Number(bbox["width"]),
        height: Number(bbox["height"]),
      },
      ...(typeof rec["maskBase64"] === "string" ? { maskBase64: rec["maskBase64"] } : {}),
    };
  });
}
type Observation = { key: string; value: string; uncertainty: "observed" | "uncertain" };
function parseObservations(outputText: string): Observation[] {
  try {
    const parsed = JSON.parse(stripFence(outputText)) as unknown;
    if (Array.isArray(parsed)) {
      const items = parsed
        .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
        .filter(
          (i) =>
            typeof i["key"] === "string" &&
            (i["key"] as string).trim() &&
            typeof i["value"] === "string" &&
            (i["value"] as string).trim(),
        )
        .slice(0, 20)
        .map((i) => ({
          key: String(i["key"]).slice(0, 100),
          value: String(i["value"]).slice(0, 500),
          uncertainty: (i["uncertainty"] === "observed" ? "observed" : "uncertain") as
            "observed" | "uncertain",
        }));
      if (items.length) return items;
    }
  } catch {
    // fall through to summary observation
  }
  const value = outputText.trim().slice(0, 500);
  if (!value) throw providerUnavailable();
  return [{ key: "summary", value, uncertainty: "uncertain" as const }];
}
function asSegmentResult(raw: unknown): MetaSegmentResult {
  if (typeof raw !== "object" || raw === null) throw providerUnavailable();
  const rec = raw as Record<string, unknown>;
  if (typeof rec["outputText"] !== "string") throw providerUnavailable();
  return {
    providerRequestId:
      typeof rec["providerRequestId"] === "string" ? rec["providerRequestId"] : null,
    outputText: rec["outputText"],
  };
}
function asGenerateResult(raw: unknown): MetaGenerateResult {
  if (typeof raw !== "object" || raw === null) throw providerUnavailable();
  const rec = raw as Record<string, unknown>;
  if (typeof rec["imageBase64"] !== "string" || !rec["imageBase64"]) throw providerUnavailable();
  return {
    providerRequestId:
      typeof rec["providerRequestId"] === "string" ? rec["providerRequestId"] : null,
    modelId:
      typeof rec["modelId"] === "string" && rec["modelId"] ? rec["modelId"] : META_MODELS.generate,
    imageBase64: rec["imageBase64"],
  };
}
async function sanitizeProviderImage(bytes: Uint8Array) {
  const mime = sniffMime(bytes);
  if (!mime) throw providerUnavailable();
  try {
    return await sanitizeImage(bytes, mime);
  } catch {
    throw providerUnavailable();
  }
}

export async function runJob(
  db: Db,
  deps: { meta?: MetaAdapter; media?: MediaStore; config?: TailorConfig },
  jobId: string,
): Promise<void> {
  const initial = await getJobRow(db, jobId).catch(() => null);
  if (!initial || TERMINAL.has(initial.state) || initial.state === "cancelled") return;
  const job = initial;
  const fail = async (code: string) => {
    await updateJob(db, jobId, [
      ["state", "failed"],
      ["error_code", code],
      ["retryable", code === "PROVIDER_UNAVAILABLE" || code === "FEATURE_UNAVAILABLE" ? 1 : 0],
      ["finished_at", nowMs()],
      ["updated_at", nowMs()],
    ]).catch(() => undefined);
    await settleQuietly(db, job.owner_user_id, jobId, "release");
  };
  const setStage = async (stage: string) => {
    await updateJob(db, jobId, [
      ["stage", stage],
      ["updated_at", nowMs()],
    ]);
  };
  const recordStep = async (
    stepKey: string,
    state: "completed" | "failed",
    modelId: string | null,
    promptVersion: string | null,
    providerRequestId: string | null,
    output: unknown,
  ) => {
    const now = nowMs();
    const outputJson = stepOutputJson(output);
    const existing = await db
      .prepare("SELECT * FROM ai_step_runs WHERE job_id = ? AND step_key = ?")
      .bind(jobId, stepKey)
      .first<{ id: string }>();
    if (existing) {
      await db
        .prepare(
          "UPDATE ai_step_runs SET state = ?, model_id = ?, prompt_version = ?, provider_request_id = ?, output_json = ?, attempt_count = attempt_count + 1, updated_at = ? WHERE id = ?",
        )
        .bind(state, modelId, promptVersion, providerRequestId, outputJson, now, existing.id)
        .run();
    } else {
      await db
        .prepare(
          "INSERT INTO ai_step_runs (id, job_id, step_key, state, model_id, prompt_version, provider_request_id, provider_file_ids_json, artifact_ids_json, output_json, usage_json, upstream_cost_minor, currency, attempt_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          newId("stp"),
          jobId,
          stepKey,
          state,
          modelId,
          promptVersion,
          providerRequestId,
          null,
          "[]",
          outputJson,
          null,
          null,
          null,
          1,
          now,
          now,
        )
        .run();
    }
  };
  async function step<T>(
    stepKey: string,
    modelId: string | null,
    promptVersion: string | null,
    fn: () => Promise<{ value: T; providerRequestId?: string | null; output?: unknown }>,
  ): Promise<T> {
    try {
      const r = await fn();
      await recordStep(
        stepKey,
        "completed",
        modelId,
        promptVersion,
        r.providerRequestId ?? null,
        r.output ?? null,
      );
      return r.value;
    } catch (e) {
      const code = e instanceof TailorError ? e.code : "PROVIDER_UNAVAILABLE";
      await recordStep(stepKey, "failed", modelId, promptVersion, null, { errorCode: code }).catch(
        () => undefined,
      );
      throw e;
    }
  }

  try {
    await db
      .prepare(
        "UPDATE ai_jobs SET state = ?, attempt_count = attempt_count + 1, updated_at = ? WHERE id = ?",
      )
      .bind("running", nowMs(), jobId)
      .run();

    let result: JobResult;
    if (job.type === "assemble_brief") {
      await setStage("assembling");
      const brief = await assembleBrief(db, job.owner_user_id, job.project_id, job.revision_id);
      result = { type: "assemble_brief", briefId: brief.id };
    } else if (job.type === "analyze_fabric") {
      if (!deps.meta || !deps.media) throw providerUnavailable();
      const meta = deps.meta;
      const media = deps.media;
      const revision = await getRevision(db, job.owner_user_id, job.project_id, job.revision_id);
      const sourceAssetId = revision.input.fabric.sourceAssetId;
      if (!sourceAssetId) throw err("FABRIC_UNKNOWN", "Fabric source is unknown.");
      const asset = await db
        .prepare("SELECT * FROM assets WHERE id = ? AND project_id = ? AND state = ?")
        .bind(sourceAssetId, job.project_id, "ready")
        .first<AssetRow>();
      if (!asset) throw err("FABRIC_UNKNOWN", "Fabric source is unknown.");
      const bytes = await media.getPrivate(asset.object_key);
      const imageDataUrl = bytesToDataUrl(bytes, sniffMime(bytes) ?? asset.mime);
      await setStage("segmenting");
      const segment = await step(
        "segment_fabric",
        META_MODELS.segment,
        META_PROMPT_VERSIONS.segment,
        async () => {
          const r = asSegmentResult(
            await meta.segmentFabric({ imageDataUrl, prompt: "fabric textile cloth material" }),
          );
          return {
            value: r,
            providerRequestId: r.providerRequestId,
            output: { outputText: r.outputText.slice(0, 1000) },
          };
        },
      );
      const regions = parseRegions(segment.outputText);
      await setStage("persisting");
      const outRegions: { id: string; maskAssetId: string; bbox: RegionInput["bbox"] }[] = [];
      for (const region of regions) {
        if (!region.maskBase64) throw providerUnavailable();
        let maskBytes: Uint8Array;
        try {
          maskBytes = base64ToBytes(region.maskBase64);
        } catch {
          throw providerUnavailable();
        }
        const sanitized = await sanitizeProviderImage(maskBytes);
        const maskAssetId = newId("ast");
        await media.putPrivate(`private/${job.project_id}/${maskAssetId}`, sanitized.bytes);
        await insertDerivedAsset(db, {
          id: maskAssetId,
          projectId: job.project_id,
          ownerUserId: job.owner_user_id,
          kind: "fabric_mask",
          mime: sanitized.mime,
          bytes: sanitized.bytes.length,
          widthPx: sanitized.widthPx,
          heightPx: sanitized.heightPx,
          sha256: sanitized.sha256,
          parentAssetId: sourceAssetId,
          originJobId: jobId,
        });
        outRegions.push({ id: region.id, maskAssetId, bbox: region.bbox });
      }
      await setStage("understanding");
      const understood = await step(
        "understand_fabric",
        META_MODELS.understand,
        META_PROMPT_VERSIONS.understand,
        async () => {
          const r = asSegmentResult(
            await meta.understandFabric({
              imageDataUrl,
              prompt:
                'Return only a JSON array of fabric observations. Each item must be {"key": string, "value": string, "uncertainty": "observed" or "uncertain"} and cover fabric color, pattern, weave and drape.',
            }),
          );
          return {
            value: r,
            providerRequestId: r.providerRequestId,
            output: { outputText: r.outputText.slice(0, 1000) },
          };
        },
      );
      const observations = parseObservations(understood.outputText);
      result = {
        type: "analyze_fabric",
        sourceAssetId,
        segmentation: { status: "completed", regions: outRegions, errorCode: null },
        observations,
      };
    } else if (job.type === "generate_concept") {
      if (!deps.meta || !deps.media) throw providerUnavailable();
      const meta = deps.meta;
      const media = deps.media;
      const revision = await getRevision(db, job.owner_user_id, job.project_id, job.revision_id);
      const input = revision.input;
      const prompt = `Garment concept visualization: template ${input.template?.id ?? "unspecified"} v${input.template?.version ?? "-"}, design options ${JSON.stringify(input.design.optionIds)}, fit ${input.overview.fit}. Show the garment made from the reference fabric.`;
      const fabricAssetId = input.fabric.selection?.cropAssetId ?? input.fabric.sourceAssetId;
      let fabricAsset: AssetRow | null = null;
      if (fabricAssetId) {
        fabricAsset = await db
          .prepare("SELECT * FROM assets WHERE id = ? AND project_id = ? AND state = ?")
          .bind(fabricAssetId, job.project_id, "ready")
          .first<AssetRow>();
      }
      let imageDataUrl: string | undefined;
      if (fabricAsset) {
        const bytes = await media.getPrivate(fabricAsset.object_key);
        imageDataUrl = bytesToDataUrl(bytes, sniffMime(bytes) ?? fabricAsset.mime);
      }
      await setStage("generating");
      const generated = await step(
        "generate_concept",
        META_MODELS.generate,
        META_PROMPT_VERSIONS.generate,
        async () => {
          const r = asGenerateResult(
            await meta.generateConcept({ prompt, ...(imageDataUrl ? { imageDataUrl } : {}) }),
          );
          return {
            value: r,
            providerRequestId: r.providerRequestId,
            output: { modelId: r.modelId },
          };
        },
      );
      let imageBytes: Uint8Array;
      try {
        imageBytes = base64ToBytes(generated.imageBase64);
      } catch {
        throw providerUnavailable();
      }
      const sanitized = await sanitizeProviderImage(imageBytes);
      await setStage("persisting");
      const assetId = newId("ast");
      await media.putPrivate(`private/${job.project_id}/${assetId}`, sanitized.bytes);
      const assetRow = await insertDerivedAsset(db, {
        id: assetId,
        projectId: job.project_id,
        ownerUserId: job.owner_user_id,
        kind: "concept",
        mime: sanitized.mime,
        bytes: sanitized.bytes.length,
        widthPx: sanitized.widthPx,
        heightPx: sanitized.heightPx,
        sha256: sanitized.sha256,
        parentAssetId: fabricAsset?.id ?? null,
        originJobId: jobId,
      });
      result = {
        type: "generate_concept",
        asset: toAsset(assetRow),
        inputSnapshot: input,
        modelId: META_MODELS.generate,
        promptVersion: META_PROMPT_VERSIONS.generate,
        providerRequestId: generated.providerRequestId,
        warnings: [],
      };
    } else {
      throw providerUnavailable();
    }

    const validated = jobResultSchema.parse(result);
    await updateJob(db, jobId, [
      ["state", "completed"],
      ["result_json", JSON.stringify(validated)],
      ["error_code", null],
      ["retryable", 0],
      ["finished_at", nowMs()],
      ["updated_at", nowMs()],
    ]);
    await settleQuietly(db, job.owner_user_id, jobId, "debit");
  } catch (e) {
    const code = e instanceof TailorError ? e.code : "PROVIDER_UNAVAILABLE";
    await fail(code).catch(() => undefined);
  }
}
