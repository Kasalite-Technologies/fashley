import { z } from "zod";
import {
  contentHashSchema,
  enteredMeasurementUnitSchema,
  idSchema,
  isoDateTimeSchema,
  measurementUnitSchema,
  versionSchema,
} from "./common";
import { measurementInputSchema, projectInputSchema } from "./project-input";

export const constraintResultSchema = z
  .object({
    status: z.enum(["sufficient", "insufficient", "unknown"]),
    rule: z
      .object({
        templateId: idSchema,
        version: versionSchema,
        ruleVersion: z.string().min(1).max(100),
      })
      .strict()
      .nullable(),
    availableLengthMm: z.number().int().positive().nullable(),
    requiredLengthMm: z.number().int().positive().nullable(),
    assumptions: z.array(z.string().max(500)).max(20),
    reasons: z
      .array(
        z
          .object({
            code: z.string().min(1).max(100),
            message: z.string().min(1).max(500),
            fieldPath: z.string().max(200).optional(),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
export type ConstraintResult = z.infer<typeof constraintResultSchema>;

export const blockerSchema = z
  .object({
    code: z.string().min(1).max(100),
    message: z.string().min(1).max(500),
    fieldPath: z.string().max(200).optional(),
    blocks: z.array(z.enum(["concept", "finalize", "accept"])).min(1),
  })
  .strict();
export type Blocker = z.infer<typeof blockerSchema>;

export const assetSchema = z
  .object({
    id: idSchema,
    projectId: idSchema,
    kind: z.string().min(1).max(100),
    mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
    bytes: z.number().int().nonnegative(),
    widthPx: z.number().int().positive(),
    heightPx: z.number().int().positive(),
    parentAssetId: idSchema.nullable(),
    createdAt: isoDateTimeSchema,
  })
  .strict();
export type Asset = z.infer<typeof assetSchema>;

const bboxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().gt(0).max(1),
    height: z.number().gt(0).max(1),
  })
  .strict();

export const jobResultSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("analyze_fabric"),
      sourceAssetId: idSchema,
      segmentation: z
        .object({
          status: z.enum(["completed", "failed"]),
          regions: z.array(
            z
              .object({ id: z.string().min(1).max(128), maskAssetId: idSchema, bbox: bboxSchema })
              .strict(),
          ),
          errorCode: z.string().max(100).nullable(),
        })
        .strict(),
      observations: z.array(
        z
          .object({
            key: z.string().min(1).max(100),
            value: z.string().min(1).max(500),
            uncertainty: z.enum(["observed", "uncertain"]),
          })
          .strict(),
      ),
    })
    .strict(),
  z
    .object({
      type: z.literal("generate_concept"),
      asset: assetSchema,
      inputSnapshot: projectInputSchema,
      modelId: z.string().min(1).max(200),
      promptVersion: z.string().min(1).max(100),
      providerRequestId: z.string().max(200).nullable(),
      warnings: z.array(z.string().max(500)).max(20),
    })
    .strict(),
  z.object({ type: z.literal("assemble_brief"), briefId: idSchema }).strict(),
]);
export type JobResult = z.infer<typeof jobResultSchema>;

export const jobSchema = z
  .object({
    id: idSchema,
    projectId: idSchema,
    revisionId: idSchema,
    type: z.enum(["analyze_fabric", "generate_concept", "assemble_brief"]),
    state: z.enum([
      "queued",
      "running",
      "retry_wait",
      "needs_attention",
      "completed",
      "failed",
      "cancelled",
    ]),
    stage: z
      .enum(["validating", "segmenting", "understanding", "generating", "assembling", "persisting"])
      .nullable(),
    attemptCount: z.number().int().nonnegative(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    retryAfterMs: z.number().int().nonnegative().nullable(),
    result: jobResultSchema.nullable(),
    error: z
      .object({
        code: z.string().min(1).max(100),
        message: z.string().min(1).max(500),
        retryable: z.boolean(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type Job = z.infer<typeof jobSchema>;

export const measurementViewSchema = measurementInputSchema
  .extend({
    id: idSchema,
    verification: z
      .object({
        status: z.enum(["unverified", "verified"]),
        actorName: z.string().max(100).nullable(),
        method: z.string().max(100).nullable(),
        verifiedAt: isoDateTimeSchema.nullable(),
      })
      .strict(),
  })
  .strict();
export type MeasurementView = z.infer<typeof measurementViewSchema>;

export const briefContentSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: z.string().min(1).max(100),
    template: z
      .object({ id: idSchema, version: versionSchema, name: z.string().min(1).max(200) })
      .strict(),
    inputSnapshot: projectInputSchema,
    conceptAssetId: idSchema,
    fabricAssetId: idSchema,
    measurements: z.array(measurementViewSchema),
    constraint: constraintResultSchema,
    materials: z.array(
      z
        .object({
          label: z.string().min(1).max(200),
          quantity: z.string().max(100).nullable(),
          source: z.enum(["user", "template"]),
        })
        .strict(),
    ),
    decisions: z.array(z.string().max(1000)).max(50),
    assumptions: z.array(z.string().max(1000)).max(50),
    questions: z.array(
      z
        .object({
          id: idSchema,
          text: z.string().min(1).max(500),
          required: z.boolean(),
          resolved: z.boolean(),
          source: z.enum(["user", "template", "agent"]),
        })
        .strict(),
    ),
    provenance: z
      .object({
        modelIds: z.array(z.string().max(200)),
        promptVersion: z.string().min(1).max(100),
        ruleVersion: z.string().max(100).nullable(),
      })
      .strict(),
    disclaimer: z.string().min(1).max(2000),
  })
  .strict();
export type BriefContent = z.infer<typeof briefContentSchema>;

export const reviewStatusSchema = z.enum([
  "awaiting_review",
  "changes_requested",
  "design_approved",
  "accepted",
]);

export const briefSchema = z
  .object({
    id: idSchema,
    projectId: idSchema,
    revisionId: idSchema,
    briefNumber: z.number().int().positive(),
    state: z.enum(["draft", "finalized", "superseded"]),
    contentHash: contentHashSchema,
    createdAt: isoDateTimeSchema,
    finalizedAt: isoDateTimeSchema.nullable(),
    content: briefContentSchema,
    assets: z.array(assetSchema),
    blockers: z.array(blockerSchema),
    review: z
      .object({
        status: reviewStatusSchema,
        requiredMeasurementCount: z.number().int().nonnegative(),
        verifiedMeasurementCount: z.number().int().nonnegative(),
        actions: z.array(z.lazy(() => reviewActionSchema)),
      })
      .strict(),
  })
  .strict();
export type Brief = z.infer<typeof briefSchema>;

export const reviewActionSchema = z
  .object({
    id: idSchema,
    briefId: idSchema,
    action: z.enum(["request_changes", "approve_design", "verify_measurements", "accept_brief"]),
    reviewerName: z.string().min(1).max(100),
    credentialType: z.enum(["possession_link", "link_and_pin", "clerk_verified"]),
    identityVerified: z.boolean(),
    note: z.string().max(2000).nullable(),
    createdAt: isoDateTimeSchema,
  })
  .strict();
export type ReviewAction = z.infer<typeof reviewActionSchema>;

export const briefSummarySchema = z
  .object({
    id: idSchema,
    briefNumber: z.number().int().positive(),
    state: z.enum(["draft", "finalized", "superseded"]),
    reviewStatus: reviewStatusSchema,
    createdAt: isoDateTimeSchema,
    finalizedAt: isoDateTimeSchema.nullable(),
  })
  .strict();

export const revisionSchema = z
  .object({
    id: idSchema,
    projectId: idSchema,
    number: z.number().int().positive(),
    input: projectInputSchema,
    inputHash: contentHashSchema,
    createdAt: isoDateTimeSchema,
  })
  .strict();
export type Revision = z.infer<typeof revisionSchema>;

export const projectDetailSchema = z
  .object({
    project: z
      .object({
        id: idSchema,
        title: z.string().min(1).max(100),
        status: z.enum(["active", "archived", "deleting", "deleted"]),
        version: versionSchema,
        currentRevisionId: idSchema.nullable(),
        latestBriefId: idSchema.nullable(),
        updatedAt: isoDateTimeSchema,
      })
      .strict(),
    draft: z
      .object({
        version: versionSchema,
        baseRevisionId: idSchema.nullable(),
        input: projectInputSchema,
      })
      .strict(),
    currentRevision: revisionSchema.nullable(),
    latestJob: jobSchema.nullable(),
    latestBriefSummary: briefSummarySchema.nullable(),
  })
  .strict();
export type ProjectDetail = z.infer<typeof projectDetailSchema>;

export const projectSummarySchema = z
  .object({
    id: idSchema,
    title: z.string().min(1).max(100),
    templateName: z.string().max(200).nullable(),
    thumbnailAssetId: idSchema.nullable(),
    status: z.enum(["active", "archived"]),
    reviewStatus: reviewStatusSchema.nullable(),
    currentRevisionNumber: z.number().int().positive().nullable(),
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const templateSummarySchema = z
  .object({
    id: idSchema,
    version: versionSchema,
    name: z.string().min(1).max(200),
    garmentKind: z.string().min(1).max(100),
    description: z.string().max(1000),
  })
  .strict();

export const templateDetailSchema = templateSummarySchema
  .extend({
    measurementFields: z.array(
      z
        .object({
          name: z.string().min(1).max(100),
          kind: z.enum(["body", "garment"]),
          label: z.string().min(1).max(200),
          guidance: z.string().max(1000),
          required: z.boolean(),
          unit: enteredMeasurementUnitSchema,
        })
        .strict(),
    ),
    designOptions: z.array(
      z
        .object({
          id: z.string().min(1).max(100),
          label: z.string().min(1).max(200),
          choices: z.array(
            z
              .object({ id: z.string().min(1).max(100), label: z.string().min(1).max(200) })
              .strict(),
          ),
        })
        .strict(),
    ),
    hasReviewedRule: z.boolean(),
  })
  .strict();

export const meResponseSchema = z
  .object({
    user: z
      .object({ id: idSchema, displayName: z.string().max(200), email: z.string().email() })
      .strict(),
    preferences: z
      .object({
        measurementUnit: measurementUnitSchema,
        timezone: z.string().min(1).max(100),
        version: versionSchema,
      })
      .strict(),
    credits: z
      .object({
        available: z.number().int().nonnegative(),
        reserved: z.number().int().nonnegative(),
      })
      .strict(),
    capabilities: z.object({ personUpload: z.boolean(), manualCrop: z.boolean() }).strict(),
    policy: z
      .object({
        version: z.string().min(1).max(100),
        personRetentionDays: z.number().int().nonnegative(),
      })
      .strict(),
    jobQuotes: z
      .object({
        analyze_fabric: z.number().int().nonnegative(),
        generate_concept: z.number().int().nonnegative(),
        assemble_brief: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();
export type MeResponse = z.infer<typeof meResponseSchema>;

export const consentSchema = z
  .object({
    id: idSchema,
    purpose: z.enum(["ai_fabric", "ai_person", "tailor_share", "public_demo"]),
    policyVersion: z.string().min(1).max(100),
    projectId: idSchema.nullable(),
    grantedAt: isoDateTimeSchema,
    withdrawnAt: isoDateTimeSchema.nullable(),
  })
  .strict();

export const checksResponseSchema = z
  .object({
    constraint: constraintResultSchema,
    missingMeasurements: z.array(z.string().max(100)),
    unverifiedMeasurements: z.array(z.string().max(100)),
    blockers: z.array(blockerSchema),
  })
  .strict();

export const shareGrantSummarySchema = z
  .object({
    id: idSchema,
    briefId: idSchema,
    expiresAt: isoDateTimeSchema,
    revokedAt: isoDateTimeSchema.nullable(),
    includeMeasurements: z.boolean(),
    permittedAssetIds: z.array(idSchema),
    actions: z.array(
      z.enum(["request_changes", "approve_design", "verify_measurements", "accept_brief"]),
    ),
    createdAt: isoDateTimeSchema,
  })
  .strict();
