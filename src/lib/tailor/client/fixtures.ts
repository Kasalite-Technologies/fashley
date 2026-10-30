import {
  briefSchema,
  checksResponseSchema,
  emptyProjectInput,
  FIXTURES,
  fixtureBrief,
  fixtureConceptAsset,
  fixtureFabricAsset,
  fixtureInputComplete,
  fixtureMe,
  fixtureProjectDetail,
  fixtureRedactedBriefNoMeasurements,
  fixtureTemplateDetail,
  jobSchema,
  meResponseSchema,
  projectDetailSchema,
  templateDetailSchema,
  type Job,
  type ProjectDetail,
  type ProjectInput,
} from "@/lib/tailor/contracts";
import type { TailorApi } from "./api";
import { TailorApiError } from "./errors";

const NOW = "2026-10-30T10:00:00.000Z";
const HASH = "a".repeat(64);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function error(
  code: ConstructorParameters<typeof TailorApiError>[0]["code"],
  message: string,
  extra: Partial<ConstructorParameters<typeof TailorApiError>[0]> = {},
): TailorApiError {
  return new TailorApiError({
    code,
    message,
    retryable: false,
    requestId: "req_fixture",
    ...extra,
  });
}

/**
 * Fixture adapter (fixtures F01 to F16). Implements the same TailorApi
 * boundary as the HTTP adapter from synthetic contract fixtures only.
 * Every payload returned here is parsed through the frozen contract schemas.
 * This is test/development evidence only, never live-backend evidence.
 */
export function createFixtureTailorApi(): TailorApi {
  let project: ProjectDetail = projectDetailSchema.parse(clone(fixtureProjectDetail));
  let brief = briefSchema.parse(clone(fixtureBrief));
  let shares: Array<{
    id: string;
    briefId: string;
    expiresAt: string;
    revokedAt: string | null;
    includeMeasurements: boolean;
    permittedAssetIds: string[];
    actions: Array<"request_changes" | "approve_design" | "verify_measurements" | "accept_brief">;
    createdAt: string;
  }> = [];
  const consents: Array<{
    id: string;
    purpose: "ai_fabric" | "ai_person" | "tailor_share" | "public_demo";
    policyVersion: string;
    projectId: string | null;
    grantedAt: string;
    withdrawnAt: string | null;
  }> = [];
  let reviewGranted = false;
  let seq = 1;
  const jobs = new Map<string, Job>();

  const summary = () => ({
    id: project.project.id,
    title: project.project.title,
    templateName: fixtureTemplateDetail.name,
    thumbnailAssetId: null,
    status: (project.project.status === "archived" ? "archived" : "active") as
      "active" | "archived",
    reviewStatus: brief.review.status,
    currentRevisionNumber: project.currentRevision?.number ?? null,
    updatedAt: project.project.updatedAt,
  });

  function saveDraft(input: ProjectInput) {
    project = {
      ...project,
      draft: { ...project.draft, version: project.draft.version + 1, input: clone(input) },
      project: {
        ...project.project,
        version: project.project.version + 1,
        title: input.overview.title,
        updatedAt: NOW,
      },
    };
    return {
      draftVersion: project.draft.version,
      projectVersion: project.project.version,
      savedAt: NOW,
    };
  }

  const api: TailorApi = {
    me: async () => meResponseSchema.parse(clone(fixtureMe)),
    updatePreferences: async (body) => {
      const b = body as { measurementUnit: "cm" | "in"; timezone: string };
      return { measurementUnit: b.measurementUnit, timezone: b.timezone, version: 2 };
    },
    listTemplates: async () => ({
      items: [
        {
          id: fixtureTemplateDetail.id,
          version: 1,
          name: fixtureTemplateDetail.name,
          garmentKind: fixtureTemplateDetail.garmentKind,
          description: fixtureTemplateDetail.description,
        },
      ],
      nextCursor: null,
    }),
    getTemplate: async () => templateDetailSchema.parse(clone(fixtureTemplateDetail)),
    listConsents: async () => ({ items: clone(consents) }),
    createConsent: async (body) => {
      const b = body as {
        purpose: (typeof consents)[number]["purpose"];
        policyVersion: string;
        projectId?: string;
      };
      const consent = {
        id: `cns_fixture_${seq++}`,
        purpose: b.purpose,
        policyVersion: b.policyVersion,
        projectId: b.projectId ?? null,
        grantedAt: NOW,
        withdrawnAt: null,
      };
      consents.push(consent);
      return clone(consent);
    },
    withdrawConsent: async (id) => {
      const found = consents.find((c) => c.id === id);
      if (!found) throw error("NOT_FOUND", "Consent not found.");
      found.withdrawnAt = NOW;
      shares = shares.map((s) => ({ ...s, revokedAt: s.revokedAt ?? NOW }));
      return { consent: clone(found), cleanupScheduled: true };
    },
    listProjects: async (p = {}) => {
      let items = [summary()];
      if (p.query)
        items = items.filter((i) => i.title.toLowerCase().includes(p.query!.toLowerCase()));
      if (p.status && p.status !== "all") items = items.filter((i) => i.status === p.status);
      if (p.reviewStatus && p.reviewStatus !== "all")
        items = items.filter((i) => i.reviewStatus === p.reviewStatus);
      return { items, nextCursor: null };
    },
    createProject: async (body) => {
      const b = body as {
        title: string;
        template: { id: string; version: number };
        timezone: string;
        fit: ProjectInput["overview"]["fit"];
      };
      const input = emptyProjectInput(b.title, b.timezone);
      input.template = b.template;
      input.overview.fit = b.fit;
      project = projectDetailSchema.parse({
        project: {
          id: "prj_fixture_1",
          title: b.title,
          status: "active",
          version: 1,
          currentRevisionId: null,
          latestBriefId: null,
          updatedAt: NOW,
        },
        draft: { version: 1, baseRevisionId: null, input },
        currentRevision: null,
        latestJob: null,
        latestBriefSummary: null,
      });
      return clone(project);
    },
    getProject: async (id) => {
      if (id !== project.project.id) throw error("NOT_FOUND", "Project not found.");
      return clone(project);
    },
    patchDraft: async (_id, body) => {
      const b = body as { expectedDraftVersion: number; input: ProjectInput };
      if (b.expectedDraftVersion !== project.draft.version) {
        throw error(
          "REVISION_CONFLICT",
          "This project changed. Reload the latest saved draft before continuing.",
          { currentVersion: project.draft.version },
        );
      }
      return saveDraft(b.input);
    },
    createRevision: async (_id, body) => {
      const b = body as { expectedDraftVersion: number; expectedProjectVersion: number };
      if (
        b.expectedDraftVersion !== project.draft.version ||
        b.expectedProjectVersion !== project.project.version
      ) {
        throw error(
          "REVISION_CONFLICT",
          "This project changed. Reload the latest saved draft before continuing.",
          { currentVersion: project.project.version },
        );
      }
      const number = (project.currentRevision?.number ?? 0) + 1;
      const revision = {
        id: `rev_fixture_${number}`,
        projectId: project.project.id,
        number,
        input: clone(project.draft.input),
        inputHash: HASH,
        createdAt: NOW,
      };
      project = {
        ...project,
        currentRevision: revision,
        draft: { ...project.draft, baseRevisionId: revision.id },
        project: { ...project.project, currentRevisionId: revision.id },
      };
      return { revision: clone(revision), projectVersion: project.project.version };
    },
    archiveProject: async (_id, body) => {
      const b = body as { archived: boolean };
      project = {
        ...project,
        project: {
          ...project.project,
          status: b.archived ? "archived" : "active",
          version: project.project.version + 1,
        },
      };
      return {
        projectId: project.project.id,
        status: b.archived ? ("archived" as const) : ("active" as const),
        projectVersion: project.project.version,
      };
    },
    deleteProject: async () => ({
      projectId: project.project.id,
      status: "deleting" as const,
      cleanupId: "cln_fixture_1",
    }),
    getHistory: async () => ({
      items: [
        ...(project.currentRevision
          ? [
              {
                kind: "revision" as const,
                id: project.currentRevision.id,
                createdAt: NOW,
                summary: `Input revision ${project.currentRevision.number} saved`,
                revisionId: project.currentRevision.id,
              },
            ]
          : []),
        {
          kind: "brief" as const,
          id: brief.id,
          createdAt: NOW,
          summary: `Brief ${brief.briefNumber} ${brief.state}`,
          briefId: brief.id,
          status: brief.state,
        },
      ],
      nextCursor: null,
    }),
    createUploadIntent: async () => ({
      uploadId: "upl_fixture_1",
      putUrl: "/api/tailor/projects/prj_fixture_1/uploads/upl_fixture_1/content",
      expiresAt: NOW,
      maxBytes: 10_485_760,
    }),
    uploadContent: async () => undefined,
    completeUpload: async () => ({
      uploadId: "upl_fixture_1",
      status: "ready" as const,
      asset: clone(fixtureFabricAsset),
      error: null,
    }),
    getUpload: async () => ({
      uploadId: "upl_fixture_1",
      status: "ready" as const,
      asset: clone(fixtureFabricAsset),
      error: null,
    }),
    fabricSelection: async (_projectId, body) => {
      const b = body as { method: "sam" | "manual_crop"; sourceAssetId: string };
      const selection = {
        method: b.method,
        sourceAssetId: b.sourceAssetId,
        cropAssetId: fixtureFabricAsset.id,
        maskAssetId: null,
        regionId: null,
        analysisJobId: null,
      };
      return { selection, asset: clone(fixtureFabricAsset) };
    },
    startJob: async (_projectId, body) => {
      const b = body as { type: Job["type"]; revisionId: string };
      const job = jobSchema.parse({
        id: `job_fixture_${seq++}`,
        projectId: project.project.id,
        revisionId: b.revisionId,
        type: b.type,
        state: "completed",
        stage: "persisting",
        attemptCount: 1,
        createdAt: NOW,
        updatedAt: NOW,
        retryAfterMs: null,
        result:
          b.type === "generate_concept"
            ? {
                type: "generate_concept",
                asset: fixtureConceptAsset,
                inputSnapshot: fixtureInputComplete,
                modelId: "fixture-model",
                promptVersion: "fixture-v1",
                providerRequestId: null,
                warnings: [],
              }
            : {
                type: "analyze_fabric",
                sourceAssetId: fixtureFabricAsset.id,
                segmentation: { status: "completed", regions: [], errorCode: null },
                observations: [],
              },
        error: null,
      });
      jobs.set(job.id, job);
      project = { ...project, latestJob: job };
      return { job: clone(job), credits: { reserved: 0 } };
    },
    getJob: async (jobId) => {
      const job = jobs.get(jobId);
      if (!job) throw error("NOT_FOUND", "Job not found.");
      return clone(job);
    },
    cancelJob: async (jobId) => {
      const job = jobs.get(jobId);
      if (!job) throw error("NOT_FOUND", "Job not found.");
      const cancelled = { ...job, state: "cancelled" as const };
      jobs.set(jobId, cancelled);
      return clone(cancelled);
    },
    retryJob: async (jobId) => {
      const job = jobs.get(jobId);
      if (!job || (job.state !== "retry_wait" && job.state !== "needs_attention")) {
        throw error(
          "JOB_NOT_RETRYABLE",
          "This job cannot be retried. Start the step again to create a new job.",
        );
      }
      const retried = { ...job, state: "queued" as const };
      jobs.set(jobId, retried);
      return clone(retried);
    },
    runChecks: async () => {
      const f04 = FIXTURES.find((f) => f.id === "F04");
      if (!f04 || f04.kind !== "payload")
        throw error("FEATURE_UNAVAILABLE", "Checks are not available.");
      return checksResponseSchema.parse(clone(f04.value));
    },
    createBrief: async (_projectId, body) => {
      const b = body as { revisionId: string };
      const job = jobSchema.parse({
        id: `job_fixture_${seq++}`,
        projectId: project.project.id,
        revisionId: b.revisionId,
        type: "assemble_brief",
        state: "completed",
        stage: "persisting",
        attemptCount: 1,
        createdAt: NOW,
        updatedAt: NOW,
        retryAfterMs: null,
        result: { type: "assemble_brief", briefId: brief.id },
        error: null,
      });
      jobs.set(job.id, job);
      return { job: clone(job) };
    },
    getBrief: async (briefId) => {
      if (briefId !== brief.id) throw error("NOT_FOUND", "Brief not found.");
      return clone(brief);
    },
    finalizeBrief: async (_briefId, body) => {
      const b = body as { expectedContentHash: string };
      if (b.expectedContentHash !== brief.contentHash)
        throw error("REVISION_CONFLICT", "This brief changed. Reload it before finalizing.");
      brief = { ...brief, state: "finalized", finalizedAt: NOW };
      project = {
        ...project,
        project: {
          ...project.project,
          latestBriefId: brief.id,
          version: project.project.version + 1,
        },
      };
      return { brief: clone(brief), projectVersion: project.project.version };
    },
    listShares: async () => ({ items: clone(shares) }),
    createShare: async (briefId, body) => {
      const b = body as {
        includeMeasurements: boolean;
        permittedAssetIds: string[];
        actions: (typeof shares)[number]["actions"];
        expiresInHours: number;
      };
      const grant = {
        id: `grt_fixture_${seq++}`,
        briefId,
        expiresAt: NOW,
        revokedAt: null,
        includeMeasurements: b.includeMeasurements,
        permittedAssetIds: b.permittedAssetIds,
        actions: b.actions,
        createdAt: NOW,
      };
      shares.push(grant);
      return {
        grant: clone(grant),
        reviewUrl: "/review/synthetic-fixture-token-not-a-credential-0001",
      };
    },
    revokeShare: async (shareId) => {
      const found = shares.find((s) => s.id === shareId);
      if (!found) throw error("NOT_FOUND", "Share not found.");
      found.revokedAt = NOW;
      reviewGranted = false;
      return { id: shareId, revokedAt: NOW };
    },
    reviewExchange: async (body) => {
      const b = body as { token?: string };
      if (!b.token || b.token.length < 20)
        throw error(
          "INVALID_REVIEW_CREDENTIAL",
          "This review link is not valid. Ask the customer for a current link.",
        );
      reviewGranted = true;
      return { briefId: brief.id, expiresAt: NOW };
    },
    reviewSession: async () => {
      if (!reviewGranted)
        throw error(
          "INVALID_REVIEW_CREDENTIAL",
          "This review link is not valid. Ask the customer for a current link.",
        );
      return {
        grant: {
          id: "grt_fixture_1",
          expiresAt: NOW,
          actions: ["approve_design" as const],
          includeMeasurements: false,
        },
        brief: clone(fixtureRedactedBriefNoMeasurements),
        capabilities: { canApprove: true, canVerify: false, canAccept: false, blockingReasons: [] },
        reviewerIdentity: { method: "possession_link" as const, verified: false as const },
      };
    },
    reviewAction: async (body) => {
      if (!reviewGranted)
        throw error(
          "INVALID_REVIEW_CREDENTIAL",
          "This review link is not valid. Ask the customer for a current link.",
        );
      const b = body as {
        action: "request_changes" | "approve_design" | "verify_measurements" | "accept_brief";
        reviewerName: string;
        note?: string;
      };
      if (b.action === "verify_measurements" || b.action === "accept_brief") {
        throw error("FORBIDDEN", "This action is not available for this review link.");
      }
      const status =
        b.action === "request_changes"
          ? ("changes_requested" as const)
          : ("design_approved" as const);
      brief = { ...brief, review: { ...brief.review, status } };
      return {
        action: {
          id: `act_fixture_${seq++}`,
          briefId: brief.id,
          action: b.action,
          reviewerName: b.reviewerName,
          credentialType: "possession_link" as const,
          identityVerified: false,
          note: b.note ?? null,
          createdAt: NOW,
        },
        review: { status, requiredMeasurementCount: 1, verifiedMeasurementCount: 0 },
        capabilities: {
          canApprove: b.action !== "request_changes",
          canVerify: false,
          canAccept: false,
          blockingReasons: [],
        },
      };
    },
    reviewLogout: async () => {
      reviewGranted = false;
      return { ok: true as const };
    },
    ownerAssetUrl: (assetId) => `/api/tailor/assets/${encodeURIComponent(assetId)}`,
    reviewAssetUrl: (assetId) => `/api/tailor/review/assets/${encodeURIComponent(assetId)}`,
  };
  return api;
}
