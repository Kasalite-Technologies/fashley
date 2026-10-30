import type { Db } from "./db";
import { TailorError, errorEnvelope, err, newRequestId } from "./errors";
import {
  defaultConfig,
  type MediaStore,
  type MetaAdapter,
  type TailorConfig,
  type WorkflowAdapter,
} from "./config";
import {
  completeUpload,
  createUploadIntent,
  getOwnedAssetRow,
  getUploadStatus,
  receiveUploadContent,
} from "./uploads";
import { cancelJob, createBriefJob, createJob, getJobForUser, retryJob } from "./jobs";
import {
  ensureLocalUser,
  getMe,
  updatePreferences,
  listConsents,
  createConsent,
  withdrawConsent,
  type VerifiedActor,
} from "./identity";
import { listPublishedTemplates, getPublishedTemplate, templateDetail } from "./templates";
import {
  createProject,
  getProjectDetail,
  listProjects,
  saveDraft,
  freezeRevision,
  archiveProject,
  deleteProject,
} from "./projects";
import { finalizeBrief, getOwnedBrief, runChecks } from "./briefs";
import {
  createShare,
  listShares,
  revokeShare,
  exchangeReview,
  getReviewSessionView,
  submitReviewAction,
  logoutReview,
} from "./shares";
import { requireIdempotencyKey } from "./receipts";
import {
  updatePreferencesRequestSchema,
  createConsentRequestSchema,
  createProjectRequestSchema,
  patchDraftRequestSchema,
  createRevisionRequestSchema,
  archiveProjectRequestSchema,
  deleteProjectRequestSchema,
  checksRequestSchema,
  createUploadRequestSchema,
  startJobRequestSchema,
  createBriefRequestSchema,
  retryJobRequestSchema,
  finalizeBriefRequestSchema,
  createShareRequestSchema,
  reviewExchangeRequestSchema,
  reviewActionRequestSchema,
} from "../contracts";

export interface TailorHttpDeps {
  db?: Db;
  /** Injectable Clerk verifier: returns verified subject/profile or null. Never trust a raw header in default config. */
  verifier?: (request: Request) => Promise<VerifiedActor | null>;
  config?: TailorConfig;
  jobsEnabled?: boolean;
  media?: MediaStore;
  meta?: MetaAdapter;
  workflow?: WorkflowAdapter;
}
let registered: TailorHttpDeps | undefined;
export function setTailorHttpDeps(deps: TailorHttpDeps | undefined) {
  registered = deps;
  // Dev servers can load this module more than once (entry wrapper vs route
  // handlers); the global fallback in resolveTailorHttpDeps bridges instances.
  (globalThis as unknown as { __tailorHttpDeps?: TailorHttpDeps | undefined }).__tailorHttpDeps =
    deps;
}
export function resolveTailorHttpDeps(): TailorHttpDeps {
  if (registered) return registered;
  const g = globalThis as unknown as { __tailorHttpDeps?: TailorHttpDeps };
  return g.__tailorHttpDeps ?? {};
}

function json(status: number, body: unknown, extra?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
}
export function createTailorHandlers(deps: TailorHttpDeps) {
  const config = deps.config ?? defaultConfig;
  async function wrap(
    fn: () => Promise<{ status: number; data: unknown; headers?: HeadersInit }>,
  ): Promise<Response> {
    const requestId = newRequestId();
    try {
      const r = await fn();
      return json(r.status, { data: r.data, requestId }, r.headers);
    } catch (e) {
      const { body, status } = errorEnvelope(e, requestId);
      return json(status, body);
    }
  }
  function requireDb(): Db {
    if (!deps.db) throw err("FEATURE_UNAVAILABLE", "Tailor database binding is not configured.");
    return deps.db;
  }
  async function owner(request: Request) {
    const db = requireDb();
    if (!deps.verifier) throw err("FEATURE_UNAVAILABLE", "Clerk verifier is not configured.");
    const actor = await deps.verifier(request);
    if (!actor) throw err("UNAUTHENTICATED", "Sign in required.");
    const { userId } = await ensureLocalUser(db, actor);
    return { db, actor, userId };
  }
  async function body<T>(
    request: Request,
    schema: {
      safeParse: (v: unknown) => {
        success: boolean;
        data?: T;
        error?: { flatten: () => { fieldErrors: Record<string, string[]> } };
      };
    },
  ): Promise<T> {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw err("INVALID_INPUT", "Malformed JSON body.");
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fe = parsed.error?.flatten().fieldErrors;
      throw new TailorError(
        "INVALID_INPUT",
        "Invalid request.",
        undefined,
        fe as Record<string, string[]>,
      );
    }
    return parsed.data as T;
  }
  const key = (request: Request) => requireIdempotencyKey(request.headers.get("Idempotency-Key"));
  const reviewCookie = (request: Request) => {
    const c = request.headers.get("cookie") ?? "";
    const m = c.match(/(?:^|;\s*)tailor_review=([^;]+)/);
    if (!m) throw err("INVALID_REVIEW_CREDENTIAL", "Review session is invalid or expired.");
    return decodeURIComponent(m[1]!);
  };
  const unavailableJob = () => {
    throw err(
      "FEATURE_UNAVAILABLE",
      "Durable jobs are not configured (Workflow/Meta unavailable).",
    );
  };
  function requireMedia(): MediaStore {
    if (!deps.media) throw err("FEATURE_UNAVAILABLE", "Tailor media binding is not configured.");
    return deps.media;
  }
  const jobDeps = () => ({
    ...(deps.workflow ? { workflow: deps.workflow } : {}),
    ...(deps.meta ? { meta: deps.meta } : {}),
    ...(deps.media ? { media: deps.media } : {}),
    config,
  });

  return {
    me: (request: Request) =>
      wrap(async () => {
        const { db, actor, userId } = await owner(request);
        return { status: 200, data: await getMe(db, userId, actor, config) };
      }),
    updatePreferences: (request: Request) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        const req = await body(request, updatePreferencesRequestSchema);
        return { status: 200, data: await updatePreferences(db, userId, req) };
      }),
    templates: (request: Request) =>
      wrap(async () => {
        const { db } = await owner(request);
        const limit = Number(new URL(request.url).searchParams.get("limit") ?? 20);
        return {
          status: 200,
          data: {
            items: await listPublishedTemplates(db, Math.min(50, Math.max(1, limit || 20))),
            nextCursor: null,
          },
        };
      }),
    template: (request: Request, id: string) =>
      wrap(async () => {
        const { db } = await owner(request);
        const v = new URL(request.url).searchParams.get("version");
        return {
          status: 200,
          data: templateDetail(await getPublishedTemplate(db, id, v ? Number(v) : undefined)),
        };
      }),
    consents: (request: Request) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        return { status: 200, data: await listConsents(db, userId) };
      }),
    createConsent: (request: Request) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        const req = await body(request, createConsentRequestSchema);
        const r = await createConsent(db, userId, await key(request), req);
        return { status: r.replayed ? 200 : 201, data: r.consent };
      }),
    withdrawConsent: (request: Request, id: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        await body(request, {
          safeParse: (v: unknown) => ({ success: typeof v === "object" && v !== null, data: v }),
        });
        return { status: 200, data: await withdrawConsent(db, userId, id, await key(request)) };
      }),
    projects: (request: Request) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        const u = new URL(request.url);
        return {
          status: 200,
          data: await listProjects(db, userId, {
            status: u.searchParams.get("status") ?? "all",
            limit: Number(u.searchParams.get("limit") ?? 20),
          }),
        };
      }),
    createProject: (request: Request) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        const req = await body(request, createProjectRequestSchema);
        const r = await createProject(db, userId, await key(request), req);
        return { status: r.replayed ? 200 : 201, data: r.detail };
      }),
    project: (request: Request, id: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        return { status: 200, data: await getProjectDetail(db, userId, id) };
      }),
    saveDraft: (request: Request, id: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        const req = await body(request, patchDraftRequestSchema);
        return { status: 200, data: await saveDraft(db, userId, id, req) };
      }),
    createRevision: (request: Request, id: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        const req = await body(request, createRevisionRequestSchema);
        const r = await freezeRevision(db, userId, id, await key(request), req);
        return {
          status: r.replayed || r.reused ? 200 : 201,
          data: { revision: r.revision, projectVersion: r.projectVersion },
        };
      }),
    archiveProject: (request: Request, id: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        const req = await body(request, archiveProjectRequestSchema);
        return { status: 200, data: await archiveProject(db, userId, id, await key(request), req) };
      }),
    deleteProject: (request: Request, id: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        const req = await body(request, deleteProjectRequestSchema);
        return { status: 202, data: await deleteProject(db, userId, id, await key(request), req) };
      }),
    checks: (request: Request, id: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        const req = await body(request, checksRequestSchema);
        return { status: 200, data: await runChecks(db, userId, id, req.revisionId) };
      }),
    createUploadIntent: (request: Request, id: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        requireMedia();
        const req = await body(request, createUploadRequestSchema);
        const data = await createUploadIntent(db, userId, id, await key(request), req, config);
        return { status: 201, data };
      }),
    uploadContent: (request: Request, id: string, uploadId: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        const media = requireMedia();
        const bytes = new Uint8Array(await request.arrayBuffer());
        const data = await receiveUploadContent(db, media, userId, id, uploadId, bytes);
        return { status: 200, data };
      }),
    completeUpload: (request: Request, id: string, uploadId: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        const media = requireMedia();
        await body(request, {
          safeParse: (v: unknown) => ({ success: typeof v === "object" && v !== null, data: v }),
        });
        const data = await completeUpload(db, media, userId, id, uploadId, await key(request));
        return { status: 200, data };
      }),
    getUpload: (request: Request, id: string, uploadId: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        return { status: 200, data: await getUploadStatus(db, userId, id, uploadId) };
      }),
    assetContent: async (request: Request, id: string): Promise<Response> => {
      const requestId = newRequestId();
      try {
        const { db, userId } = await owner(request);
        const media = requireMedia();
        const row = await getOwnedAssetRow(db, userId, id);
        const bytes = await media.getPrivate(row.object_key);
        return new Response(bytes as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": row.mime,
            "Content-Length": String(bytes.byteLength),
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (e) {
        const { body: b, status } = errorEnvelope(e, requestId);
        return json(status, b);
      }
    },
    startJob: (request: Request, id: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        if (!deps.workflow && !deps.jobsEnabled) unavailableJob();
        const req = await body(request, startJobRequestSchema);
        const data = await createJob(db, jobDeps(), userId, id, await key(request), req);
        return { status: 201, data };
      }),
    getJob: (request: Request, jobId: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        return { status: 200, data: await getJobForUser(db, userId, jobId) };
      }),
    cancelJob: (request: Request, jobId: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        await key(request);
        return { status: 200, data: await cancelJob(db, userId, jobId) };
      }),
    retryJob: (request: Request, jobId: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        if (!deps.workflow && !deps.jobsEnabled) unavailableJob();
        await body(request, retryJobRequestSchema);
        await key(request);
        const data = await retryJob(db, jobDeps(), userId, jobId);
        return { status: 200, data };
      }),
    createBriefJob: (request: Request, id: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        if (!deps.workflow && !deps.jobsEnabled) unavailableJob();
        const req = await body(request, createBriefRequestSchema);
        const data = await createBriefJob(
          db,
          jobDeps(),
          userId,
          id,
          await key(request),
          req.revisionId,
        );
        return { status: 201, data };
      }),
    brief: (request: Request, id: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        return { status: 200, data: await getOwnedBrief(db, userId, id) };
      }),
    finalizeBrief: (request: Request, id: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        const req = await body(request, finalizeBriefRequestSchema);
        return { status: 200, data: await finalizeBrief(db, userId, id, await key(request), req) };
      }),
    shares: (request: Request, id: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        return { status: 200, data: await listShares(db, userId, id) };
      }),
    createShare: (request: Request, id: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        const req = await body(request, createShareRequestSchema);
        const r = await createShare(db, userId, id, await key(request), req);
        return { status: r.replayed ? 200 : 201, data: r };
      }),
    revokeShare: (request: Request, id: string) =>
      wrap(async () => {
        const { db, userId } = await owner(request);
        return { status: 200, data: await revokeShare(db, userId, id, await key(request)) };
      }),
    reviewExchange: (request: Request) =>
      wrap(async () => {
        const db = requireDb();
        const req = await body(request, reviewExchangeRequestSchema);
        const r = await exchangeReview(db, req);
        return {
          status: 200,
          data: { briefId: r.briefId, expiresAt: r.expiresAt },
          headers: {
            "Set-Cookie": `tailor_review=${encodeURIComponent(r.sessionToken)}; HttpOnly; Path=/api/tailor/review; SameSite=Lax; Max-Age=3600`,
          },
        };
      }),
    reviewSession: (request: Request) =>
      wrap(async () => {
        const db = requireDb();
        return { status: 200, data: await getReviewSessionView(db, reviewCookie(request)) };
      }),
    reviewAction: (request: Request) =>
      wrap(async () => {
        const db = requireDb();
        const req = await body(request, reviewActionRequestSchema);
        const r = await submitReviewAction(db, reviewCookie(request), await key(request), req);
        return {
          status: r.replayed ? 200 : 201,
          data: { action: r.action, review: r.review, capabilities: r.capabilities },
        };
      }),
    reviewLogout: (request: Request) =>
      wrap(async () => {
        const db = requireDb();
        try {
          await logoutReview(db, reviewCookie(request));
        } catch {
          /* clearing anyway */
        }
        return {
          status: 200,
          data: { ok: true },
          headers: {
            "Set-Cookie":
              "tailor_review=; HttpOnly; Path=/api/tailor/review; SameSite=Lax; Max-Age=0",
          },
        };
      }),
  };
}
export type TailorHandlers = ReturnType<typeof createTailorHandlers>;
export const handlersFromEnv = () => createTailorHandlers(resolveTailorHttpDeps());
