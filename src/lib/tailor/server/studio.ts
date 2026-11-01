import { z } from "zod";
import { err, errorEnvelope, newId, newRequestId, notFound } from "./errors";
import { ensureLocalUser, type VerifiedActor } from "./identity";
import { resolveTailorHttpDeps, type TailorHttpDeps } from "./http";
import { base64ToBytes, type MetaGenerateResult } from "./meta";
import { buildDesignPrompt } from "@/lib/design-prompt.server";
import { DESIGN_OPTIONS, type DesignKind } from "@/lib/design-options";

/**
 * Design studio on the Cloudflare stack: Clerk-verified owner, Meta
 * generation, private R2 image storage, D1 metadata. No coins, no legacy
 * accounts. Provider failures fail closed as PROVIDER_UNAVAILABLE.
 */

const MAX_IMAGE_DATA_URL_CHARS = 8_000_000;

const preferencesSchema = z.object({
  kind: z.enum(["outfits", "shoes", "bags"]),
  category: z.string().min(1).max(50),
  occasion: z.string().max(50),
  style: z.string().min(1).max(50),
  hardware: z.enum(["Gold", "Silver", "Black", "None"]),
  notes: z.string().max(200),
});

const generateSchema = z.object({
  imageDataUrl: z
    .string()
    .min(1)
    .max(MAX_IMAGE_DATA_URL_CHARS)
    .regex(/^data:image\/(jpeg|png|webp);base64,/),
  preferences: preferencesSchema,
  count: z.number().int().min(1).max(4),
});

const saveSchema = z.object({
  imageBase64: z.string().min(1).max(MAX_IMAGE_DATA_URL_CHARS),
  preferences: preferencesSchema,
});

type Preferences = z.infer<typeof preferencesSchema>;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function owner(deps: TailorHttpDeps, request: Request) {
  if (!deps.db) throw err("FEATURE_UNAVAILABLE", "Database is not configured.");
  if (!deps.verifier) throw err("FEATURE_UNAVAILABLE", "Sign-in is not configured.");
  const actor: VerifiedActor | null = await deps.verifier(request);
  if (!actor) throw err("UNAUTHENTICATED", "Sign in required.");
  const { userId } = await ensureLocalUser(deps.db, actor);
  return { db: deps.db, userId };
}

async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw err("INVALID_INPUT", "Malformed JSON body.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw err("INVALID_INPUT", "Invalid request.");
  return parsed.data;
}

function validatePreferences(p: Preferences): Preferences {
  const options = DESIGN_OPTIONS[p.kind as DesignKind];
  if (!options.categories.includes(p.category) || !options.styles.includes(p.style))
    throw err("INVALID_INPUT", "Invalid design choices.");
  return p;
}

function asGenerateResult(raw: unknown): MetaGenerateResult {
  if (typeof raw !== "object" || raw === null) throw err("PROVIDER_UNAVAILABLE", "Meta provider is unavailable.");
  const rec = raw as Record<string, unknown>;
  if (typeof rec["imageBase64"] !== "string" || !rec["imageBase64"])
    throw err("PROVIDER_UNAVAILABLE", "Meta provider is unavailable.");
  return {
    providerRequestId: typeof rec["providerRequestId"] === "string" ? rec["providerRequestId"] : null,
    modelId: typeof rec["modelId"] === "string" && rec["modelId"] ? rec["modelId"] : "muse-image-1.0",
    imageBase64: rec["imageBase64"],
  };
}

interface StudioDesignRow {
  id: string;
  user_id: string;
  kind: string;
  category: string;
  style: string;
  occasion: string;
  hardware: string;
  notes: string;
  object_key: string;
  mime: string;
  created_at: number;
}

const toDesign = (r: StudioDesignRow) => ({
  id: r.id,
  kind: r.kind,
  category: r.category,
  style: r.style,
  occasion: r.occasion,
  hardware: r.hardware,
  notes: r.notes,
  createdAt: new Date(r.created_at).toISOString(),
});

export function createStudioHandlers() {
  const wrap = async (fn: () => Promise<Response>): Promise<Response> => {
    const requestId = newRequestId();
    try {
      return await fn();
    } catch (e) {
      const { body: b, status } = errorEnvelope(e, requestId);
      return json(status, b);
    }
  };

  return {
    generate: (request: Request) =>
      wrap(async () => {
        const deps = resolveTailorHttpDeps();
        await owner(deps, request);
        if (!deps.meta) throw err("FEATURE_UNAVAILABLE", "Generation is not configured.");
        const meta = deps.meta;
        const req = await body(request, generateSchema);
        const preferences = validatePreferences(req.preferences);
        const settled = await Promise.allSettled(
          Array.from({ length: req.count }, (_, i) =>
            meta
              .generateConcept({
                prompt: buildDesignPrompt({ ...preferences, variant: i }),
                imageDataUrl: req.imageDataUrl,
              })
              .then(asGenerateResult),
          ),
        );
        const images = settled
          .filter(
            (r): r is PromiseFulfilledResult<MetaGenerateResult> => r.status === "fulfilled",
          )
          .map((r) => ({ imageBase64: r.value.imageBase64 }));
        if (!images.length)
          throw err("PROVIDER_UNAVAILABLE", "Meta provider is unavailable.");
        return json(200, {
          data: { images, warnings: settled.length - images.length > 0 ? ["Some previews could not be generated."] : [] },
        });
      }),
    designs: (request: Request) =>
      wrap(async () => {
        const deps = resolveTailorHttpDeps();
        const { db, userId } = await owner(deps, request);
        const { results } = await db
          .prepare("SELECT * FROM studio_designs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100")
          .bind(userId)
          .all<StudioDesignRow>();
        return json(200, { data: { items: results.map(toDesign) } });
      }),
    saveDesign: (request: Request) =>
      wrap(async () => {
        const deps = resolveTailorHttpDeps();
        const { db, userId } = await owner(deps, request);
        if (!deps.media) throw err("FEATURE_UNAVAILABLE", "Media storage is not configured.");
        const req = await body(request, saveSchema);
        validatePreferences(req.preferences);
        let bytes: Uint8Array;
        try {
          bytes = base64ToBytes(req.imageBase64.replace(/^data:image\/[a-z]+;base64,/, ""));
        } catch {
          throw err("INVALID_INPUT", "Image data could not be read.");
        }
        if (!bytes.length || bytes.length > 12_000_000) throw err("INVALID_INPUT", "Image data could not be read.");
        const id = newId("sdg");
        const objectKey = `studio/${userId}/${id}.png`;
        await deps.media.putPrivate(objectKey, bytes);
        const now = Date.now();
        await db
          .prepare(
            "INSERT INTO studio_designs (id, user_id, kind, category, style, occasion, hardware, notes, object_key, mime, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            id,
            userId,
            req.preferences.kind,
            req.preferences.category,
            req.preferences.style,
            req.preferences.occasion,
            req.preferences.hardware,
            req.preferences.notes,
            objectKey,
            "image/png",
            now,
          )
          .run();
        const row = await db
          .prepare("SELECT * FROM studio_designs WHERE id = ?")
          .bind(id)
          .first<StudioDesignRow>();
        return json(201, { data: toDesign(row!) });
      }),
    designImage: (request: Request, id: string) =>
      wrap(async () => {
        const deps = resolveTailorHttpDeps();
        const { db, userId } = await owner(deps, request);
        if (!deps.media) throw err("FEATURE_UNAVAILABLE", "Media storage is not configured.");
        const row = await db
          .prepare("SELECT * FROM studio_designs WHERE id = ? AND user_id = ?")
          .bind(id, userId)
          .first<StudioDesignRow>();
        if (!row) throw notFound();
        const bytes = await deps.media.getPrivate(row.object_key);
        return new Response(bytes as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": row.mime,
            "Content-Length": String(bytes.byteLength),
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }),
    deleteDesign: (request: Request, id: string) =>
      wrap(async () => {
        const deps = resolveTailorHttpDeps();
        const { db, userId } = await owner(deps, request);
        if (!deps.media) throw err("FEATURE_UNAVAILABLE", "Media storage is not configured.");
        const row = await db
          .prepare("SELECT * FROM studio_designs WHERE id = ? AND user_id = ?")
          .bind(id, userId)
          .first<StudioDesignRow>();
        if (!row) throw notFound();
        await deps.media.deletePrivate(row.object_key).catch(() => undefined);
        await db.prepare("DELETE FROM studio_designs WHERE id = ?").bind(id).run();
        return json(200, { data: { ok: true } });
      }),
  };
}

export const studioHandlers = () => createStudioHandlers();
