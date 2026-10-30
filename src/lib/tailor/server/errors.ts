import type { ApiError, ErrorCode } from "../contracts";

export const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  REVISION_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  CONSENT_REQUIRED: 422,
  UPLOAD_REJECTED: 422,
  ASSET_NOT_READY: 409,
  MISSING_MEASUREMENTS: 422,
  FABRIC_UNKNOWN: 422,
  FABRIC_INSUFFICIENT: 422,
  BRIEF_BLOCKED: 422,
  BUDGET_EXCEEDED: 409,
  PROVIDER_UNAVAILABLE: 503,
  AMBIGUOUS_PROVIDER_RESULT: 409,
  JOB_NOT_RETRYABLE: 409,
  SHARE_EXPIRED: 410,
  SHARE_REVOKED: 410,
  INVALID_REVIEW_CREDENTIAL: 401,
  RATE_LIMITED: 429,
  FEATURE_UNAVAILABLE: 503,
};
const RETRYABLE = new Set<ErrorCode>([
  "PROVIDER_UNAVAILABLE",
  "RATE_LIMITED",
  "FEATURE_UNAVAILABLE",
]);

export class TailorError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public currentVersion?: number,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "TailorError";
  }
  get status() {
    return STATUS_BY_CODE[this.code];
  }
  get retryable() {
    return RETRYABLE.has(this.code);
  }
}

export const err = (code: ErrorCode, message: string, currentVersion?: number) =>
  new TailorError(code, message, currentVersion);
export const notFound = () => err("NOT_FOUND", "Not found.");
export const conflict = (currentVersion?: number) =>
  err(
    "REVISION_CONFLICT",
    "This project changed. Reload the latest saved draft before continuing.",
    currentVersion,
  );

let reqCounter = 0;
export const newRequestId = () =>
  `req_${Date.now().toString(36)}_${(++reqCounter).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
export const newId = (prefix: string) =>
  `${prefix}_${crypto.getRandomValues(new Uint8Array(12)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")}`;

export function errorEnvelope(
  e: unknown,
  requestId = newRequestId(),
): { body: ApiError; status: number } {
  if (e instanceof TailorError) {
    return {
      status: e.status,
      body: {
        error: {
          code: e.code,
          message: e.message,
          retryable: e.retryable,
          ...(e.currentVersion !== undefined ? { currentVersion: e.currentVersion } : {}),
          ...(e.fieldErrors ? { fieldErrors: e.fieldErrors } : {}),
        },
        requestId,
      },
    };
  }
  return {
    status: 503,
    body: {
      error: {
        code: "FEATURE_UNAVAILABLE",
        message: "Tailor service is not configured.",
        retryable: true,
      },
      requestId,
    },
  };
}
