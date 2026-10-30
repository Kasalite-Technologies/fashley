import { z } from "zod";

export const CONTRACT_VERSION = 1;

export const idSchema = z.string().min(1).max(128);
export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const requestIdSchema = z.string().min(1).max(128);
export const versionSchema = z.number().int().min(1);
export const contentHashSchema = z.string().min(16).max(128);

export const idempotencyKeySchema = z
  .string()
  .regex(/^[\x21-\x7E]{16,128}$/, "Idempotency-Key must be 16-128 printable ASCII characters");

export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "NOT_FOUND",
  "FORBIDDEN",
  "INVALID_INPUT",
  "REVISION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "CONSENT_REQUIRED",
  "UPLOAD_REJECTED",
  "ASSET_NOT_READY",
  "MISSING_MEASUREMENTS",
  "FABRIC_UNKNOWN",
  "FABRIC_INSUFFICIENT",
  "BRIEF_BLOCKED",
  "BUDGET_EXCEEDED",
  "PROVIDER_UNAVAILABLE",
  "AMBIGUOUS_PROVIDER_RESULT",
  "JOB_NOT_RETRYABLE",
  "SHARE_EXPIRED",
  "SHARE_REVOKED",
  "INVALID_REVIEW_CREDENTIAL",
  "RATE_LIMITED",
  "FEATURE_UNAVAILABLE",
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const apiErrorSchema = z
  .object({
    error: z
      .object({
        code: errorCodeSchema,
        message: z.string().min(1).max(500),
        retryable: z.boolean(),
        fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
        currentVersion: versionSchema.optional(),
      })
      .strict(),
    requestId: requestIdSchema,
  })
  .strict();
export type ApiError = z.infer<typeof apiErrorSchema>;

export function successEnvelopeSchema<T extends z.ZodTypeAny>(data: T) {
  return z.object({ data, requestId: requestIdSchema }).strict();
}

export const listQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export function listResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().min(1).nullable() }).strict();
}

export const measurementUnitSchema = z.enum(["cm", "in"]);
export const enteredUnitSchema = z.enum(["mm", "cm", "in", "yd"]);
export const enteredMeasurementUnitSchema = z.enum(["mm", "cm", "in"]);

export const enteredValueSchema = z
  .object({ value: z.string().min(1).max(32), unit: enteredUnitSchema })
  .strict();
