import { apiErrorSchema, type ErrorCode } from "@/lib/tailor/contracts";

export class TailorApiError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly requestId: string | null;
  readonly fieldErrors?: Record<string, string[]>;
  readonly currentVersion?: number;

  constructor(init: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
    requestId?: string | null;
    fieldErrors?: Record<string, string[]>;
    currentVersion?: number;
  }) {
    super(init.message);
    this.name = "TailorApiError";
    this.code = init.code;
    this.retryable = init.retryable;
    this.requestId = init.requestId ?? null;
    if (init.fieldErrors !== undefined) this.fieldErrors = init.fieldErrors;
    if (init.currentVersion !== undefined) this.currentVersion = init.currentVersion;
  }
}

export function featureUnavailable(requestId: string | null = null): TailorApiError {
  return new TailorApiError({
    code: "FEATURE_UNAVAILABLE",
    message: "Tailoring is not available yet. No data was loaded or changed.",
    retryable: true,
    requestId,
  });
}

/** Parse an unknown payload into a safe error. Never surfaces raw upstream bodies. */
export function toTailorApiError(payload: unknown, fallbackStatus?: number): TailorApiError {
  const parsed = apiErrorSchema.safeParse(payload);
  if (parsed.success) {
    return new TailorApiError({
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      retryable: parsed.data.error.retryable,
      requestId: parsed.data.requestId,
      ...(parsed.data.error.fieldErrors !== undefined
        ? { fieldErrors: parsed.data.error.fieldErrors }
        : {}),
      ...(parsed.data.error.currentVersion !== undefined
        ? { currentVersion: parsed.data.error.currentVersion }
        : {}),
    });
  }
  if (fallbackStatus === 401) {
    return new TailorApiError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
      retryable: false,
    });
  }
  if (fallbackStatus === 404) {
    return new TailorApiError({
      code: "NOT_FOUND",
      message: "This item could not be found.",
      retryable: false,
    });
  }
  if (fallbackStatus === 429) {
    return new TailorApiError({
      code: "RATE_LIMITED",
      message: "Too many attempts. Wait, then try again.",
      retryable: true,
    });
  }
  if (fallbackStatus !== undefined && fallbackStatus >= 500) return featureUnavailable();
  return new TailorApiError({
    code: "INVALID_INPUT",
    message: "That request could not be completed. Check the details and try again.",
    retryable: false,
  });
}

export function isTailorApiError(value: unknown): value is TailorApiError {
  return value instanceof TailorApiError;
}

/** Safe display copy for an unknown thrown value. */
export function safeErrorMessage(error: unknown): {
  message: string;
  requestId: string | null;
  retryable: boolean;
} {
  if (error instanceof TailorApiError) {
    return { message: error.message, requestId: error.requestId, retryable: error.retryable };
  }
  return {
    message: "Something went wrong while loading. Try again.",
    requestId: null,
    retryable: true,
  };
}
