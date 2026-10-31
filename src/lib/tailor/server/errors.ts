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

export type ProviderFailureKind =
  | "http_error"
  | "network_error"
  | "non_json_response"
  | "unparseable_output"
  | "missing_api_key"
  | "provider_error";

/** Redacted provider diagnostic persisted only on internal step-run rows. Never returned to clients. */
export interface ProviderDiagnostic {
  providerStatus: number | null;
  failureKind: ProviderFailureKind;
  providerErrorCode: string | null;
  providerErrorMessage: string | null;
}

const MAX_DIAGNOSTIC_TEXT = 200;

export function sanitizeProviderDiagnosticText(
  value: unknown,
  secrets: readonly string[] = [],
): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  let text = String(value);
  for (const secret of secrets) {
    if (secret) text = text.split(secret).join("[redacted]");
  }
  text = text
    .replace(/data:[^\s"']+/gi, "[redacted]")
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(
      /\b(authorization|api[-_]?key|access[-_]?token|client[-_]?secret|secret)\b\s*[:=]\s*[^\s"',}]+/gi,
      "$1=[redacted]",
    )
    .replace(/[A-Za-z0-9+/=_-]{40,}/g, "[redacted]")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, MAX_DIAGNOSTIC_TEXT) : null;
}

export function makeProviderDiagnostic(input: {
  providerStatus: number | null;
  failureKind: ProviderFailureKind;
  providerErrorCode?: unknown;
  providerErrorMessage?: unknown;
  secrets?: readonly string[];
}): ProviderDiagnostic {
  const secrets = input.secrets ?? [];
  return {
    providerStatus:
      typeof input.providerStatus === "number" && Number.isFinite(input.providerStatus)
        ? input.providerStatus
        : null,
    failureKind: input.failureKind,
    providerErrorCode: sanitizeProviderDiagnosticText(input.providerErrorCode, secrets),
    providerErrorMessage: sanitizeProviderDiagnosticText(input.providerErrorMessage, secrets),
  };
}

export class TailorError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public currentVersion?: number,
    public fieldErrors?: Record<string, string[]>,
    public providerDiagnostic?: ProviderDiagnostic,
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
export const errWithProviderDiagnostic = (
  code: ErrorCode,
  message: string,
  providerDiagnostic: ProviderDiagnostic,
) => new TailorError(code, message, undefined, undefined, providerDiagnostic);
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
