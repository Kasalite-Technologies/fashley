import { createClerkClient, verifyToken } from "@clerk/backend";
import type { Db, DbPrepared, DbRunResult } from "./db";
import type { TailorHttpDeps } from "./http";
import type { VerifiedActor } from "./identity";
import { err, TailorError } from "./errors";
import { createR2MediaStore, type R2BucketLike } from "./media";
import { createMetaAdapter } from "./meta";
import type { ImageCropper } from "./config";

/**
 * Cloudflare runtime wiring: adapts the real D1 binding to the server Db
 * interface and builds the Clerk verifier from the Secrets Store binding.
 * Everything fails closed: a missing binding omits the dep, which the HTTP
 * layer reports as FEATURE_UNAVAILABLE; a bad token yields UNAUTHENTICATED.
 */

// ---- D1 adapter ----

interface D1RunResultLike {
  meta?: { changes?: number; last_row_id?: number | null };
}
interface D1PreparedLike {
  bind(...values: unknown[]): D1PreparedLike;
  run(): Promise<D1RunResultLike>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}
export interface D1Like {
  prepare(sql: string): D1PreparedLike;
  batch(statements: D1PreparedLike[]): Promise<D1RunResultLike[]>;
  exec(sql: string): Promise<unknown>;
}

const toRunResult = (r: D1RunResultLike): DbRunResult => ({
  changes: r.meta?.changes ?? 0,
  lastRowId: r.meta?.last_row_id ?? null,
});

class CloudflarePrepared implements DbPrepared {
  constructor(private readonly raw: D1PreparedLike) {}
  bind(...values: unknown[]): DbPrepared {
    return new CloudflarePrepared(this.raw.bind(...values));
  }
  async run(): Promise<DbRunResult> {
    return toRunResult(await this.raw.run());
  }
  first<T = Record<string, unknown>>(): Promise<T | null> {
    return this.raw.first<T>();
  }
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    return this.raw.all<T>();
  }
  unwrap(): D1PreparedLike {
    return this.raw;
  }
}

export function adaptD1(d1: D1Like): Db {
  return {
    prepare(sql: string): DbPrepared {
      return new CloudflarePrepared(d1.prepare(sql));
    },
    async batch(statements: DbPrepared[]): Promise<DbRunResult[]> {
      const raw = statements.map((s) => {
        if (!(s instanceof CloudflarePrepared)) {
          throw new Error("batch() received a statement not created by this Db adapter.");
        }
        return s.unwrap();
      });
      const results = await d1.batch(raw);
      return results.map(toRunResult);
    },
    async exec(sql: string): Promise<void> {
      await d1.exec(sql);
    },
  };
}

// ---- Secrets Store ----

type SecretBindingLike = string | { get(): Promise<string | null> } | undefined;

export function secretResolver(binding: SecretBindingLike): () => Promise<string | null> {
  if (typeof binding === "string") return async () => (binding.length > 0 ? binding : null);
  if (binding && typeof binding.get === "function") {
    return async () => {
      try {
        const value = await binding.get();
        return value && value.length > 0 ? value : null;
      } catch {
        return null;
      }
    };
  }
  return async () => null;
}

// ---- Clerk verifier ----

const PROFILE_TTL_MS = 5 * 60 * 1000;
const profileCache = new Map<string, { actor: VerifiedActor; expiresAt: number }>();

export function extractSessionToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m?.[1]) return m[1].trim();
  }
  const cookie = request.headers.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)__session=([^;]+)/);
  if (m?.[1]) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return null;
}

async function actorForSubject(secretKey: string, subject: string): Promise<VerifiedActor | null> {
  const cached = profileCache.get(subject);
  if (cached && cached.expiresAt > Date.now()) return cached.actor;
  const user = await createClerkClient({ secretKey }).users.getUser(subject);
  const email =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress;
  if (!email) return null;
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    email.split("@")[0]!;
  const actor: VerifiedActor = { subject, displayName: displayName.slice(0, 200), email };
  if (profileCache.size > 500) profileCache.clear();
  profileCache.set(subject, { actor, expiresAt: Date.now() + PROFILE_TTL_MS });
  return actor;
}

export function createClerkVerifier(
  resolveSecretKey: () => Promise<string | null>,
): (request: Request) => Promise<VerifiedActor | null> {
  return async (request) => {
    const token = extractSessionToken(request);
    if (!token) return null;
    const secretKey = await resolveSecretKey();
    if (!secretKey) return null;
    let subject: string | undefined;
    try {
      const payload = await verifyToken(token, { secretKey });
      subject = payload.sub;
    } catch {
      return null;
    }
    if (!subject) return null;
    try {
      return await actorForSubject(secretKey, subject);
    } catch {
      return null;
    }
  };
}

// ---- Cloudflare Images cropper ----

/**
 * Structural subset of the Images binding. Per the runtime types in
 * .cloudflare/types, `trim` top/left/width/height are pixel values (pixels to
 * cut from each side / resulting size), not fractions, so the normalized
 * rect is converted with the known source dimensions.
 */
export interface ImagesBindingLike {
  input(stream: ReadableStream<Uint8Array>): {
    transform(transform: {
      trim: { top: number; left: number; width: number; height: number };
    }): {
      output(options: { format: string }): Promise<{
        image(): ReadableStream<Uint8Array>;
      }>;
    };
  };
}

export function isImagesLike(value: unknown): value is ImagesBindingLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { input?: unknown }).input === "function"
  );
}

function bytesToStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

export function createImagesCropper(binding: ImagesBindingLike): ImageCropper {
  return {
    async crop({ bytes, widthPx, heightPx, rect }) {
      const left = Math.min(widthPx - 1, Math.max(0, Math.round(rect.x * widthPx)));
      const top = Math.min(heightPx - 1, Math.max(0, Math.round(rect.y * heightPx)));
      const width = Math.max(1, Math.min(Math.round(rect.width * widthPx), widthPx - left));
      const height = Math.max(1, Math.min(Math.round(rect.height * heightPx), heightPx - top));
      try {
        const result = await binding
          .input(bytesToStream(bytes))
          .transform({ trim: { top, left, width, height } })
          .output({ format: "image/jpeg" });
        const buffer = await new Response(result.image() as BodyInit).arrayBuffer();
        return new Uint8Array(buffer);
      } catch (e) {
        if (e instanceof TailorError) throw e;
        throw err("PROVIDER_UNAVAILABLE", "Image cropping failed.");
      }
    },
  };
}

// ---- Deps from Worker env ----

export interface TailorWorkerEnv {
  DB?: unknown;
  CLERK_SECRET_KEY?: SecretBindingLike;
  META_API_KEY?: SecretBindingLike;
  TAILOR_MEDIA?: unknown;
  TAILOR_WORKFLOW?: unknown;
  IMAGES?: unknown;
  [key: string]: unknown;
}

interface R2BucketFullLike extends R2BucketLike {
  head?: unknown;
}
interface WorkflowBindingLike {
  create(options: {
    id: string;
    params?: Record<string, unknown>;
  }): Promise<{ id: string } | unknown>;
}

function isR2Like(value: unknown): value is R2BucketFullLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { put?: unknown }).put === "function" &&
    typeof (value as { get?: unknown }).get === "function" &&
    typeof (value as { delete?: unknown }).delete === "function"
  );
}
function isWorkflowLike(value: unknown): value is WorkflowBindingLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { create?: unknown }).create === "function"
  );
}

function isD1Like(value: unknown): value is D1Like {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { prepare?: unknown }).prepare === "function" &&
    typeof (value as { batch?: unknown }).batch === "function"
  );
}

export function tailorDepsFromEnv(env: TailorWorkerEnv): TailorHttpDeps {
  const deps: TailorHttpDeps = {};
  if (isD1Like(env.DB)) deps.db = adaptD1(env.DB);
  if (env.CLERK_SECRET_KEY) {
    deps.verifier = createClerkVerifier(secretResolver(env.CLERK_SECRET_KEY));
  }
  if (isR2Like(env.TAILOR_MEDIA)) deps.media = createR2MediaStore(env.TAILOR_MEDIA);
  if (isImagesLike(env.IMAGES)) deps.cropper = createImagesCropper(env.IMAGES);
  if (env.META_API_KEY) {
    deps.meta = createMetaAdapter(secretResolver(env.META_API_KEY));
  }
  if (isWorkflowLike(env.TAILOR_WORKFLOW)) {
    const binding = env.TAILOR_WORKFLOW;
    deps.workflow = {
      async dispatch(jobId: string) {
        try {
          await binding.create({ id: jobId, params: { jobId } });
        } catch {
          throw err(
            "FEATURE_UNAVAILABLE",
            "Workflow dispatch failed (companion Workflow Worker unavailable).",
          );
        }
        return { workflowId: jobId };
      },
    };
  }
  return deps;
}
