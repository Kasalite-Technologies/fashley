import type { z } from "zod";
import { successEnvelopeSchema } from "@/lib/tailor/contracts";
import {
  archiveResponseSchema,
  createBriefResponseSchema,
  createShareResponseSchema,
  deleteResponseSchema,
  draftSaveResponseSchema,
  fabricSelectionResponseSchema,
  finalizeResponseSchema,
  historyListSchema,
  preferencesResponseSchema,
  projectListSchema,
  revisionResponseSchema,
  revokeShareResponseSchema,
  reviewActionResponseSchema,
  startJobResponseSchema,
  templateListSchema,
  uploadIntentSchema,
  uploadStatusSchema,
  withdrawConsentResponseSchema,
  consentListSchema,
  type TailorApi,
} from "./api";
import {
  briefSchema,
  checksResponseSchema,
  consentSchema,
  jobSchema,
  meResponseSchema,
  projectDetailSchema,
  reviewExchangeResponseSchema,
  reviewSessionResponseSchema,
  shareGrantSummarySchema,
  templateDetailSchema,
} from "@/lib/tailor/contracts";
import { z as zod } from "zod";
import { featureUnavailable, toTailorApiError } from "./errors";

type FetchFn = typeof fetch;

/** Supplies the current Clerk session token, or null when signed out. */
export type TailorTokenProvider = () => Promise<string | null>;
let tokenProvider: TailorTokenProvider | null = null;
export function setTailorTokenProvider(provider: TailorTokenProvider | null) {
  tokenProvider = provider;
}

const shareListSchema = zod.object({ items: zod.array(shareGrantSummarySchema) }).strict();
const okSchema = zod.object({ ok: zod.literal(true) }).strict();

export function createHttpTailorApi(fetchFn: FetchFn = fetch): TailorApi {
  async function request<T extends z.ZodTypeAny>(
    path: string,
    schema: T,
    init: { method?: string; body?: unknown; idempotencyKey?: string } = {},
  ): Promise<z.infer<T>> {
    let token: string | null = null;
    if (tokenProvider) {
      try {
        token = await tokenProvider();
      } catch {
        token = null;
      }
    }
    let response: Response;
    try {
      response = await fetchFn(path, {
        method: init.method ?? "GET",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      } as RequestInit);
    } catch {
      throw featureUnavailable();
    }
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      throw response.ok ? featureUnavailable() : toTailorApiError(null, response.status);
    }
    if (!response.ok) throw toTailorApiError(payload, response.status);
    const parsed = successEnvelopeSchema(schema).safeParse(payload);
    if (!parsed.success) throw featureUnavailable();
    return parsed.data.data;
  }

  return {
    me: () => request("/api/tailor/me", meResponseSchema),
    updatePreferences: (body) =>
      request("/api/tailor/me/preferences", preferencesResponseSchema, { method: "PATCH", body }),
    listTemplates: (p = {}) =>
      request(
        `/api/tailor/templates?limit=${p.limit ?? 20}${p.cursor ? `&cursor=${encodeURIComponent(p.cursor)}` : ""}`,
        templateListSchema,
      ),
    getTemplate: (id, version) =>
      request(
        `/api/tailor/templates/${encodeURIComponent(id)}${version ? `?version=${version}` : ""}`,
        templateDetailSchema,
      ),
    listConsents: () => request("/api/tailor/consents", consentListSchema),
    createConsent: (body, key) =>
      request("/api/tailor/consents", consentSchema, { method: "POST", body, idempotencyKey: key }),
    withdrawConsent: (id, key) =>
      request(
        `/api/tailor/consents/${encodeURIComponent(id)}/withdraw`,
        withdrawConsentResponseSchema,
        { method: "POST", body: {}, idempotencyKey: key },
      ),
    listProjects: (p = {}) => {
      const q = new URLSearchParams({ limit: String(p.limit ?? 20) });
      if (p.query) q.set("query", p.query);
      if (p.status) q.set("status", p.status);
      if (p.reviewStatus) q.set("reviewStatus", p.reviewStatus);
      if (p.cursor) q.set("cursor", p.cursor);
      return request(`/api/tailor/projects?${q.toString()}`, projectListSchema);
    },
    createProject: (body, key) =>
      request("/api/tailor/projects", projectDetailSchema, {
        method: "POST",
        body,
        idempotencyKey: key,
      }),
    getProject: (id) =>
      request(`/api/tailor/projects/${encodeURIComponent(id)}`, projectDetailSchema),
    patchDraft: (id, body) =>
      request(`/api/tailor/projects/${encodeURIComponent(id)}/draft`, draftSaveResponseSchema, {
        method: "PATCH",
        body,
      }),
    createRevision: (id, body, key) =>
      request(`/api/tailor/projects/${encodeURIComponent(id)}/revisions`, revisionResponseSchema, {
        method: "POST",
        body,
        idempotencyKey: key,
      }),
    archiveProject: (id, body, key) =>
      request(`/api/tailor/projects/${encodeURIComponent(id)}/archive`, archiveResponseSchema, {
        method: "POST",
        body,
        idempotencyKey: key,
      }),
    deleteProject: (id, body, key) =>
      request(`/api/tailor/projects/${encodeURIComponent(id)}`, deleteResponseSchema, {
        method: "DELETE",
        body,
        idempotencyKey: key,
      }),
    getHistory: (id, p = {}) =>
      request(
        `/api/tailor/projects/${encodeURIComponent(id)}/history?limit=${p.limit ?? 20}${p.cursor ? `&cursor=${encodeURIComponent(p.cursor)}` : ""}`,
        historyListSchema,
      ),
    createUploadIntent: (projectId, body, key) =>
      request(`/api/tailor/projects/${encodeURIComponent(projectId)}/uploads`, uploadIntentSchema, {
        method: "POST",
        body,
        idempotencyKey: key,
      }),
    uploadContent: async (putUrl, file) => {
      let response: Response;
      try {
        response = await fetchFn(putUrl, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
      } catch {
        throw featureUnavailable();
      }
      if (!response.ok) throw toTailorApiError(null, response.status);
    },
    completeUpload: (projectId, uploadId, key) =>
      request(
        `/api/tailor/projects/${encodeURIComponent(projectId)}/uploads/${encodeURIComponent(uploadId)}/complete`,
        uploadStatusSchema,
        { method: "POST", body: {}, idempotencyKey: key },
      ),
    getUpload: (projectId, uploadId) =>
      request(
        `/api/tailor/projects/${encodeURIComponent(projectId)}/uploads/${encodeURIComponent(uploadId)}`,
        uploadStatusSchema,
      ),
    fabricSelection: (projectId, body, key) =>
      request(
        `/api/tailor/projects/${encodeURIComponent(projectId)}/fabric-selection`,
        fabricSelectionResponseSchema,
        { method: "POST", body, idempotencyKey: key },
      ),
    startJob: (projectId, body, key) =>
      request(
        `/api/tailor/projects/${encodeURIComponent(projectId)}/jobs`,
        startJobResponseSchema,
        { method: "POST", body, idempotencyKey: key },
      ),
    getJob: (jobId) => request(`/api/tailor/jobs/${encodeURIComponent(jobId)}`, jobSchema),
    cancelJob: (jobId, key) =>
      request(`/api/tailor/jobs/${encodeURIComponent(jobId)}/cancel`, jobSchema, {
        method: "POST",
        body: {},
        idempotencyKey: key,
      }),
    retryJob: (jobId, body, key) =>
      request(`/api/tailor/jobs/${encodeURIComponent(jobId)}/retry`, jobSchema, {
        method: "POST",
        body,
        idempotencyKey: key,
      }),
    runChecks: (projectId, body) =>
      request(
        `/api/tailor/projects/${encodeURIComponent(projectId)}/checks`,
        checksResponseSchema,
        { method: "POST", body },
      ),
    createBrief: (projectId, body, key) =>
      request(
        `/api/tailor/projects/${encodeURIComponent(projectId)}/briefs`,
        createBriefResponseSchema,
        { method: "POST", body, idempotencyKey: key },
      ),
    getBrief: (briefId) =>
      request(`/api/tailor/briefs/${encodeURIComponent(briefId)}`, briefSchema),
    finalizeBrief: (briefId, body, key) =>
      request(
        `/api/tailor/briefs/${encodeURIComponent(briefId)}/finalize`,
        finalizeResponseSchema,
        { method: "POST", body, idempotencyKey: key },
      ),
    listShares: (briefId) =>
      request(`/api/tailor/briefs/${encodeURIComponent(briefId)}/shares`, shareListSchema),
    createShare: (briefId, body, key) =>
      request(
        `/api/tailor/briefs/${encodeURIComponent(briefId)}/shares`,
        createShareResponseSchema,
        { method: "POST", body, idempotencyKey: key },
      ),
    revokeShare: (shareId, key) =>
      request(
        `/api/tailor/shares/${encodeURIComponent(shareId)}/revoke`,
        revokeShareResponseSchema,
        { method: "POST", body: {}, idempotencyKey: key },
      ),
    reviewExchange: (body) =>
      request("/api/tailor/review/exchange", reviewExchangeResponseSchema, {
        method: "POST",
        body,
      }),
    reviewSession: () => request("/api/tailor/review/session", reviewSessionResponseSchema),
    reviewAction: (body, key) =>
      request("/api/tailor/review/actions", reviewActionResponseSchema, {
        method: "POST",
        body,
        idempotencyKey: key,
      }),
    reviewLogout: () =>
      request("/api/tailor/review/logout", okSchema, { method: "POST", body: {} }),
    ownerAssetUrl: (assetId) => `/api/tailor/assets/${encodeURIComponent(assetId)}`,
    reviewAssetUrl: (assetId) => `/api/tailor/review/assets/${encodeURIComponent(assetId)}`,
  };
}
