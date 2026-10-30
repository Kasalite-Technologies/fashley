/**
 * Query-key factory. Keys are scoped by internal user id and resource id.
 * Review tokens, PINs and raw review URLs must never be placed in a key:
 * this factory only accepts resource identifiers and filter values.
 */
export const tailorKeys = {
  root: ["tailor"] as const,
  me: () => ["tailor", "me"] as const,
  templates: (cursor?: string | null) => ["tailor", "templates", cursor ?? "first"] as const,
  template: (templateId: string, version?: number) =>
    ["tailor", "template", templateId, version ?? "latest"] as const,
  projects: (
    userId: string,
    filters: {
      query?: string;
      status?: string;
      reviewStatus?: string;
      cursor?: string | null;
    } = {},
  ) =>
    [
      "tailor",
      userId,
      "projects",
      filters.query ?? "",
      filters.status ?? "all",
      filters.reviewStatus ?? "all",
      filters.cursor ?? "first",
    ] as const,
  project: (userId: string, projectId: string) => ["tailor", userId, "project", projectId] as const,
  history: (userId: string, projectId: string, cursor?: string | null) =>
    ["tailor", userId, "project", projectId, "history", cursor ?? "first"] as const,
  brief: (userId: string, briefId: string) => ["tailor", userId, "brief", briefId] as const,
  shares: (userId: string, briefId: string) =>
    ["tailor", userId, "brief", briefId, "shares"] as const,
  job: (userId: string, jobId: string) => ["tailor", userId, "job", jobId] as const,
  upload: (userId: string, uploadId: string) => ["tailor", userId, "upload", uploadId] as const,
  consents: (userId: string) => ["tailor", userId, "consents"] as const,
  checks: (userId: string, projectId: string, revisionId: string) =>
    ["tailor", userId, "project", projectId, "checks", revisionId] as const,
  reviewSession: () => ["tailor", "review", "session"] as const,
};

function randomSuffix(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID().replace(/[^A-Za-z0-9-]/g, "");
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** One key per deliberate mutation. Reuse the same key when retrying that mutation. */
export function newIdempotencyKey(operation: string): string {
  const prefix = operation.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "tailor";
  return `${prefix}-${randomSuffix()}`.slice(0, 128);
}

/**
 * Holds one idempotency key per named deliberate action until the caller
 * confirms success (clear) or starts a genuinely new action (rotate).
 */
export class IdempotencyKeyKeeper {
  private keys = new Map<string, string>();

  keyFor(action: string): string {
    const existing = this.keys.get(action);
    if (existing) return existing;
    const created = newIdempotencyKey(action);
    this.keys.set(action, created);
    return created;
  }

  rotate(action: string): string {
    const created = newIdempotencyKey(action);
    this.keys.set(action, created);
    return created;
  }

  clear(action: string): void {
    this.keys.delete(action);
  }
}
