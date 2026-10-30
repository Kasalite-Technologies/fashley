import { z } from "zod";
import {
  assetSchema,
  briefSchema,
  checksResponseSchema,
  consentSchema,
  jobSchema,
  listResponseSchema,
  meResponseSchema,
  projectDetailSchema,
  projectSummarySchema,
  revisionSchema,
  shareGrantSummarySchema,
  templateDetailSchema,
  templateSummarySchema,
  type Brief,
  type Job,
  type MeResponse,
  type ProjectDetail,
} from "@/lib/tailor/contracts";

// Response shapes from 03-api-contracts.md composed from frozen contract schemas.
export const preferencesResponseSchema = meResponseSchema.shape.preferences;
export const projectListSchema = listResponseSchema(projectSummarySchema);
export const templateListSchema = listResponseSchema(templateSummarySchema);
export const consentListSchema = z.object({ items: z.array(consentSchema) }).strict();
export const draftSaveResponseSchema = z
  .object({
    draftVersion: z.number().int().min(1),
    projectVersion: z.number().int().min(1),
    savedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export const revisionResponseSchema = z
  .object({ revision: revisionSchema, projectVersion: z.number().int().min(1) })
  .strict();
export const archiveResponseSchema = z
  .object({
    projectId: z.string().min(1),
    status: z.enum(["active", "archived"]),
    projectVersion: z.number().int().min(1),
  })
  .strict();
export const deleteResponseSchema = z
  .object({
    projectId: z.string().min(1),
    status: z.literal("deleting"),
    cleanupId: z.string().min(1),
  })
  .strict();
export const historyItemSchema = z
  .object({
    kind: z.enum(["revision", "brief", "review", "job"]),
    id: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    summary: z.string().min(1).max(500),
    revisionId: z.string().min(1).optional(),
    briefId: z.string().min(1).optional(),
    status: z.string().max(100).optional(),
  })
  .strict();
export const historyListSchema = listResponseSchema(historyItemSchema);
export const uploadIntentSchema = z
  .object({
    uploadId: z.string().min(1),
    putUrl: z.string().min(1),
    expiresAt: z.string().datetime({ offset: true }),
    maxBytes: z.number().int().positive(),
  })
  .strict();
export const uploadStatusSchema = z
  .object({
    uploadId: z.string().min(1),
    status: z.enum(["pending", "received", "validating", "ready", "rejected", "expired"]),
    asset: assetSchema.nullable(),
    error: z
      .object({ code: z.string().min(1), message: z.string().min(1) })
      .strict()
      .nullable(),
  })
  .strict();
export const fabricSelectionResponseSchema = z
  .object({
    selection: z.object({
      method: z.enum(["sam", "manual_crop"]),
      sourceAssetId: z.string().min(1),
      cropAssetId: z.string().min(1),
      maskAssetId: z.string().nullable(),
      regionId: z.string().nullable(),
      analysisJobId: z.string().nullable(),
    }),
    asset: assetSchema,
  })
  .strict();
export const startJobResponseSchema = z
  .object({
    job: jobSchema,
    credits: z.object({ reserved: z.number().int().nonnegative() }).strict(),
  })
  .strict();
export const createBriefResponseSchema = z.object({ job: jobSchema }).strict();
export const finalizeResponseSchema = z
  .object({ brief: briefSchema, projectVersion: z.number().int().min(1) })
  .strict();
export const createShareResponseSchema = z
  .object({
    grant: shareGrantSummarySchema,
    reviewUrl: z.string().nullable(),
    linkAlreadyIssued: z.boolean().optional(),
  })
  .strict();
export const revokeShareResponseSchema = z
  .object({ id: z.string().min(1), revokedAt: z.string().datetime({ offset: true }) })
  .strict();
export const withdrawConsentResponseSchema = z
  .object({ consent: consentSchema, cleanupScheduled: z.boolean() })
  .strict();
export const reviewActionResponseSchema = z
  .object({
    action: z.object({
      id: z.string().min(1),
      briefId: z.string().min(1),
      action: z.enum(["request_changes", "approve_design", "verify_measurements", "accept_brief"]),
      reviewerName: z.string().min(1).max(100),
      credentialType: z.enum(["possession_link", "link_and_pin", "clerk_verified"]),
      identityVerified: z.boolean(),
      note: z.string().max(2000).nullable(),
      createdAt: z.string().datetime({ offset: true }),
    }),
    review: z
      .object({
        status: z.enum(["awaiting_review", "changes_requested", "design_approved", "accepted"]),
        requiredMeasurementCount: z.number().int().nonnegative(),
        verifiedMeasurementCount: z.number().int().nonnegative(),
      })
      .strict(),
    capabilities: z
      .object({
        canApprove: z.boolean(),
        canVerify: z.boolean(),
        canAccept: z.boolean(),
        blockingReasons: z.array(
          z
            .object({
              code: z.string().min(1),
              message: z.string().min(1),
              fieldPath: z.string().optional(),
              blocks: z.array(z.enum(["concept", "finalize", "accept"])).min(1),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

export type HistoryItem = z.infer<typeof historyItemSchema>;
export type UploadIntent = z.infer<typeof uploadIntentSchema>;
export type UploadStatus = z.infer<typeof uploadStatusSchema>;
export type CreateShareResponse = z.infer<typeof createShareResponseSchema>;

export interface TailorApi {
  me(): Promise<MeResponse>;
  updatePreferences(body: unknown): Promise<z.infer<typeof preferencesResponseSchema>>;
  listTemplates(params?: {
    cursor?: string;
    limit?: number;
  }): Promise<z.infer<typeof templateListSchema>>;
  getTemplate(id: string, version?: number): Promise<z.infer<typeof templateDetailSchema>>;
  listConsents(): Promise<z.infer<typeof consentListSchema>>;
  createConsent(body: unknown, idempotencyKey: string): Promise<z.infer<typeof consentSchema>>;
  withdrawConsent(
    id: string,
    idempotencyKey: string,
  ): Promise<z.infer<typeof withdrawConsentResponseSchema>>;
  listProjects(params?: {
    query?: string;
    status?: string;
    reviewStatus?: string;
    cursor?: string;
    limit?: number;
  }): Promise<z.infer<typeof projectListSchema>>;
  createProject(body: unknown, idempotencyKey: string): Promise<ProjectDetail>;
  getProject(id: string): Promise<ProjectDetail>;
  patchDraft(id: string, body: unknown): Promise<z.infer<typeof draftSaveResponseSchema>>;
  createRevision(
    id: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<z.infer<typeof revisionResponseSchema>>;
  archiveProject(
    id: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<z.infer<typeof archiveResponseSchema>>;
  deleteProject(
    id: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<z.infer<typeof deleteResponseSchema>>;
  getHistory(
    id: string,
    params?: { cursor?: string; limit?: number },
  ): Promise<z.infer<typeof historyListSchema>>;
  createUploadIntent(
    projectId: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<UploadIntent>;
  uploadContent(putUrl: string, file: Blob): Promise<void>;
  completeUpload(
    projectId: string,
    uploadId: string,
    idempotencyKey: string,
  ): Promise<UploadStatus>;
  getUpload(projectId: string, uploadId: string): Promise<UploadStatus>;
  fabricSelection(
    projectId: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<z.infer<typeof fabricSelectionResponseSchema>>;
  startJob(
    projectId: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<z.infer<typeof startJobResponseSchema>>;
  getJob(jobId: string): Promise<Job>;
  cancelJob(jobId: string, idempotencyKey: string): Promise<Job>;
  retryJob(jobId: string, body: unknown, idempotencyKey: string): Promise<Job>;
  runChecks(projectId: string, body: unknown): Promise<z.infer<typeof checksResponseSchema>>;
  createBrief(projectId: string, body: unknown, idempotencyKey: string): Promise<{ job: Job }>;
  getBrief(briefId: string): Promise<Brief>;
  finalizeBrief(
    briefId: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<z.infer<typeof finalizeResponseSchema>>;
  listShares(briefId: string): Promise<{ items: z.infer<typeof shareGrantSummarySchema>[] }>;
  createShare(briefId: string, body: unknown, idempotencyKey: string): Promise<CreateShareResponse>;
  revokeShare(
    shareId: string,
    idempotencyKey: string,
  ): Promise<z.infer<typeof revokeShareResponseSchema>>;
  reviewExchange(body: unknown): Promise<{ briefId: string; expiresAt: string }>;
  reviewSession(): Promise<import("@/lib/tailor/contracts").ReviewSessionResponse>;
  reviewAction(
    body: unknown,
    idempotencyKey: string,
  ): Promise<z.infer<typeof reviewActionResponseSchema>>;
  reviewLogout(): Promise<{ ok: true }>;
  ownerAssetUrl(assetId: string): string;
  reviewAssetUrl(assetId: string): string;
}
