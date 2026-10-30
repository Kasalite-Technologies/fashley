import { z } from "zod";
import { contentHashSchema, idSchema, isoDateTimeSchema, versionSchema } from "./common";
import { assetSchema, blockerSchema, measurementViewSchema, reviewStatusSchema } from "./dto";

export const reviewActionTypeSchema = z.enum([
  "request_changes",
  "approve_design",
  "verify_measurements",
  "accept_brief",
]);

// Allowlist schema for reviewers. It is intentionally not derived from the
// owner Brief DTO: unknown keys (owner ids, job data, provenance) are rejected.
export const redactedBriefSchema = z
  .object({
    schemaVersion: z.literal(1),
    briefId: idSchema,
    briefNumber: z.number().int().positive(),
    contentHash: contentHashSchema,
    finalizedAt: isoDateTimeSchema,
    title: z.string().min(1).max(100),
    template: z
      .object({ id: idSchema, version: versionSchema, name: z.string().min(1).max(200) })
      .strict(),
    assets: z.array(assetSchema),
    measurements: z.array(measurementViewSchema).nullable(),
    constraintStatus: z.enum(["sufficient", "insufficient", "unknown"]).nullable(),
    materials: z
      .array(
        z
          .object({ label: z.string().min(1).max(200), quantity: z.string().max(100).nullable() })
          .strict(),
      )
      .nullable(),
    decisions: z.array(z.string().max(1000)).nullable(),
    assumptions: z.array(z.string().max(1000)).nullable(),
    questions: z
      .array(
        z
          .object({ id: idSchema, text: z.string().min(1).max(500), required: z.boolean() })
          .strict(),
      )
      .nullable(),
    omittedSections: z.array(
      z.enum(["measurements", "materials", "decisions", "assumptions", "questions", "constraint"]),
    ),
    reviewStatus: reviewStatusSchema,
    disclaimer: z.string().min(1).max(2000),
  })
  .strict();
export type RedactedBrief = z.infer<typeof redactedBriefSchema>;

export const reviewSessionResponseSchema = z
  .object({
    grant: z
      .object({
        id: idSchema,
        expiresAt: isoDateTimeSchema,
        actions: z.array(reviewActionTypeSchema),
        includeMeasurements: z.boolean(),
      })
      .strict(),
    brief: redactedBriefSchema,
    capabilities: z
      .object({
        canApprove: z.boolean(),
        canVerify: z.boolean(),
        canAccept: z.boolean(),
        blockingReasons: z.array(blockerSchema),
      })
      .strict(),
    reviewerIdentity: z
      .object({ method: z.enum(["possession_link", "link_and_pin"]), verified: z.literal(false) })
      .strict(),
  })
  .strict();
export type ReviewSessionResponse = z.infer<typeof reviewSessionResponseSchema>;

export const reviewExchangeResponseSchema = z
  .object({ briefId: idSchema, expiresAt: isoDateTimeSchema })
  .strict();
