import { z } from "zod";
import {
  contentHashSchema,
  dateOnlySchema,
  idSchema,
  measurementUnitSchema,
  versionSchema,
} from "./common";
import { fitSchema, projectInputSchema } from "./project-input";
import { reviewActionTypeSchema } from "./review";

const emptySchema = z.object({}).strict();

export const updatePreferencesRequestSchema = z
  .object({
    expectedVersion: versionSchema,
    measurementUnit: measurementUnitSchema,
    timezone: z.string().min(1).max(100),
  })
  .strict();

export const createConsentRequestSchema = z
  .object({
    purpose: z.enum(["ai_fabric", "ai_person", "tailor_share", "public_demo"]),
    policyVersion: z.string().min(1).max(100),
    projectId: idSchema.optional(),
    assetIds: z.array(idSchema).max(20).optional(),
  })
  .strict();

export const withdrawConsentRequestSchema = emptySchema;

export const createProjectRequestSchema = z
  .object({
    title: z.string().min(1).max(100),
    template: z.object({ id: idSchema, version: versionSchema }).strict(),
    occasion: z.string().max(200).nullable(),
    deadline: dateOnlySchema.nullable(),
    fit: fitSchema,
    timezone: z.string().min(1).max(100),
  })
  .strict();

export const patchDraftRequestSchema = z
  .object({ expectedDraftVersion: versionSchema, input: projectInputSchema })
  .strict();

export const createRevisionRequestSchema = z
  .object({ expectedDraftVersion: versionSchema, expectedProjectVersion: versionSchema })
  .strict();

export const archiveProjectRequestSchema = z
  .object({ expectedProjectVersion: versionSchema, archived: z.boolean() })
  .strict();

export const deleteProjectRequestSchema = z
  .object({ expectedProjectVersion: versionSchema })
  .strict();

export const createUploadRequestSchema = z
  .object({
    kind: z.enum(["fabric_source", "person_source"]),
    mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
    bytes: z.number().int().positive().max(10_485_760),
    consentId: idSchema,
  })
  .strict();

export const completeUploadRequestSchema = emptySchema;

export const fabricSelectionRequestSchema = z.discriminatedUnion("method", [
  z
    .object({
      sourceAssetId: idSchema,
      method: z.literal("sam"),
      analysisJobId: idSchema,
      regionId: z.string().min(1).max(128),
    })
    .strict(),
  z
    .object({
      sourceAssetId: idSchema,
      method: z.literal("manual_crop"),
      crop: z
        .object({
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
          width: z.number().gt(0).max(1),
          height: z.number().gt(0).max(1),
        })
        .strict(),
    })
    .strict(),
]);

export const startJobRequestSchema = z
  .object({ type: z.enum(["analyze_fabric", "generate_concept"]), revisionId: idSchema })
  .strict();

export const retryJobRequestSchema = z
  .object({ acknowledgePossibleProviderCost: z.boolean().optional() })
  .strict();

export const cancelJobRequestSchema = emptySchema;

export const checksRequestSchema = z.object({ revisionId: idSchema }).strict();

export const createBriefRequestSchema = z.object({ revisionId: idSchema }).strict();

export const finalizeBriefRequestSchema = z
  .object({
    expectedProjectVersion: versionSchema,
    expectedContentHash: contentHashSchema,
    acknowledgedBlockerCodes: z.array(z.string().min(1).max(100)).max(20),
  })
  .strict();

export const createShareRequestSchema = z
  .object({
    expectedContentHash: contentHashSchema,
    expiresInHours: z.union([z.literal(1), z.literal(6), z.literal(24)]),
    includeMeasurements: z.boolean(),
    permittedAssetIds: z.array(idSchema).min(1).max(20),
    actions: z.array(reviewActionTypeSchema).min(1),
    pin: z.string().min(4).max(64).optional(),
    consentId: idSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      !value.includeMeasurements &&
      value.actions.some((a) => a === "verify_measurements" || a === "accept_brief")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actions"],
        message: "verify_measurements and accept_brief require includeMeasurements",
      });
    }
  });

export const revokeShareRequestSchema = emptySchema;

export const reviewExchangeRequestSchema = z
  .object({ token: z.string().min(20).max(512), pin: z.string().min(4).max(64).optional() })
  .strict();

export const reviewActionRequestSchema = z
  .object({
    briefId: idSchema,
    expectedContentHash: contentHashSchema,
    action: reviewActionTypeSchema,
    reviewerName: z.string().min(1).max(100),
    note: z.string().max(2000).optional(),
    verifications: z
      .array(
        z
          .object({
            measurementId: idSchema,
            valueMm: z.number().int().positive(),
            method: z.enum(["in_person_tape", "reviewed_record"]),
          })
          .strict(),
      )
      .max(50)
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.action === "request_changes" && (!value.note || value.note.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["note"],
        message: "request_changes requires a note",
      });
    }
    if (
      value.action === "verify_measurements" &&
      (!value.verifications || value.verifications.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["verifications"],
        message: "verify_measurements requires at least one verification",
      });
    }
  });

export const reviewLogoutRequestSchema = emptySchema;
