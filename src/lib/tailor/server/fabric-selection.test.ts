import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDb } from "./db";
import { createTailorHandlers, type TailorHttpDeps } from "./http";
import { InMemoryMediaStore } from "./media";
import { ensureLocalUser } from "./identity";
import { createProject, saveDraft, freezeRevision, insertAsset } from "./projects";
import { emptyProjectInput } from "../contracts";
import type { ImageCropper, NormalizedRect } from "./config";
import { createImagesCropper, type ImagesBindingLike } from "./cloudflare";

const MIGRATIONS = readdirSync(join(process.cwd(), "migrations/tailor"))
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(process.cwd(), "migrations/tailor", f), "utf8"));

async function makeDb() {
  const db = new InMemoryDb();
  for (const sql of MIGRATIONS) await db.exec(sql);
  await db
    .prepare(
      "INSERT INTO garment_templates (id, version, status, name, garment_kind, description, illustration_key, measurement_schema_json, design_options_json, rule_json, reviewer_name, reviewed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      "tpl_test",
      1,
      "published",
      "Test dress (TEST ONLY)",
      "dress",
      "test fixture",
      null,
      JSON.stringify([
        { name: "bust", kind: "body", label: "Bust", guidance: "tape", required: true, unit: "cm" },
      ]),
      JSON.stringify([]),
      JSON.stringify({
        requiredLengthMm: 2000,
        ruleVersion: "test-rule-v1",
        requiredMeasurements: ["bust"],
      }),
      "TEST ONLY fixture reviewer",
      Date.now(),
      Date.now(),
    )
    .run();
  return db;
}

const KEY = (n: string) => `fabric-test-key-${n}-1234567890`;
const PNG = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

const te = new TextEncoder();
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
function jpegSegment(marker: number, data: Uint8Array): Uint8Array {
  const len = data.length + 2;
  return concat([new Uint8Array([0xff, marker, (len >> 8) & 255, len & 255]), data]);
}
function makeJpeg(width = 3, height = 2): Uint8Array {
  const app0 = jpegSegment(
    0xe0,
    concat([te.encode("JFIF\0"), new Uint8Array([1, 1, 0, 0, 1, 0, 1, 0, 0])]),
  );
  const sof = jpegSegment(
    0xc0,
    concat([
      new Uint8Array([8, (height >> 8) & 255, height & 255, (width >> 8) & 255, width & 255, 1]),
      new Uint8Array([1, 0x11, 0]),
    ]),
  );
  const sos = jpegSegment(0xda, new Uint8Array([1, 1, 0, 0, 63, 0]));
  const scan = new Uint8Array([0x11, 0xff, 0x00, 0x22, 0xff, 0xd0, 0x33]);
  return concat([new Uint8Array([0xff, 0xd8]), app0, sof, sos, scan, new Uint8Array([0xff, 0xd9])]);
}
const JPEG = makeJpeg();

class FakeCropper implements ImageCropper {
  calls: { rect: NormalizedRect; widthPx: number; heightPx: number; mime: string }[] = [];
  async crop(input: {
    bytes: Uint8Array;
    mime: string;
    widthPx: number;
    heightPx: number;
    rect: NormalizedRect;
  }): Promise<Uint8Array> {
    this.calls.push({
      rect: input.rect,
      widthPx: input.widthPx,
      heightPx: input.heightPx,
      mime: input.mime,
    });
    return JPEG;
  }
}

function makeHandlers(
  db: InMemoryDb,
  extra: Omit<Partial<TailorHttpDeps>, "cropper"> & { cropper?: ImageCropper | undefined } = {},
) {
  const media = new InMemoryMediaStore();
  const { cropper: extraCropper, ...rest } = extra;
  const handlers = createTailorHandlers({
    db,
    verifier: async (request) => {
      const m = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
      if (!m?.[1]) return null;
      return { subject: m[1], displayName: m[1], email: `${m[1]}@example.invalid` };
    },
    media,
    ...("cropper" in extra
      ? extraCropper
        ? { cropper: extraCropper }
        : {}
      : { cropper: new FakeCropper() }),
    ...rest,
  });
  return { handlers, media };
}
const req = (subject: string, key?: string) => ({
  headers: {
    authorization: `Bearer ${subject}`,
    "content-type": "application/json",
    ...(key ? { "Idempotency-Key": key } : {}),
  },
});
const jsonReq = (subject: string, key: string, body: unknown) =>
  new Request("http://test/api", {
    method: "POST",
    ...req(subject, key),
    body: JSON.stringify(body),
  });

async function seedSource(
  db: InMemoryDb,
  media: InMemoryMediaStore,
  subject = "user_a",
  dims = { widthPx: 1, heightPx: 1 },
) {
  const { userId } = await ensureLocalUser(db, {
    subject,
    displayName: subject,
    email: `${subject}@example.invalid`,
  });
  const created = await createProject(db, userId, KEY(`create-${subject}-${Math.random()}`), {
    title: "Test dress",
    template: { id: "tpl_test", version: 1 },
    occasion: null,
    deadline: null,
    fit: "regular",
    timezone: "Africa/Accra",
  });
  const projectId = created.detail.project.id;
  await insertAsset(db, {
    id: "ast_src",
    projectId,
    ownerUserId: userId,
    kind: "fabric_source",
    mime: "image/png",
    bytes: PNG.byteLength,
    widthPx: dims.widthPx,
    heightPx: dims.heightPx,
  });
  await media.putPrivate(`private/${projectId}/ast_src`, PNG);
  return { userId, projectId };
}

describe("fabric selection", () => {
  it("manual_crop: crops, sanitizes JPEG, persists fabric_crop, returns selection", async () => {
    const db = await makeDb();
    const cropper = new FakeCropper();
    const { handlers, media } = makeHandlers(db, { cropper });
    const { projectId } = await seedSource(db, media);
    const res = await handlers.fabricSelection(
      jsonReq("user_a", KEY("manual-1"), {
        sourceAssetId: "ast_src",
        method: "manual_crop",
        crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
      }),
      projectId,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.selection).toEqual({
      method: "manual_crop",
      sourceAssetId: "ast_src",
      cropAssetId: body.data.asset.id,
      maskAssetId: null,
      regionId: null,
      analysisJobId: null,
    });
    expect(body.data.asset.kind).toBe("fabric_crop");
    expect(body.data.asset.mime).toBe("image/jpeg");
    expect(body.data.asset.parentAssetId).toBe("ast_src");
    expect(cropper.calls).toEqual([
      {
        rect: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
        widthPx: 1,
        heightPx: 1,
        mime: "image/png",
      },
    ]);
    const row = await db
      .prepare("SELECT * FROM assets WHERE id = ?")
      .bind(body.data.asset.id)
      .first<{ kind: string; parent_asset_id: string; origin_job_id: string | null }>();
    expect(row?.kind).toBe("fabric_crop");
    expect(row?.parent_asset_id).toBe("ast_src");
  });

  it("rejects crop overflow with INVALID_INPUT and does not call cropper", async () => {
    const db = await makeDb();
    const cropper = new FakeCropper();
    const { handlers, media } = makeHandlers(db, { cropper });
    const { projectId } = await seedSource(db, media);
    const res = await handlers.fabricSelection(
      jsonReq("user_a", KEY("overflow-1"), {
        sourceAssetId: "ast_src",
        method: "manual_crop",
        crop: { x: 0.6, y: 0, width: 0.5, height: 0.5 },
      }),
      projectId,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_INPUT");
    expect(cropper.calls).toHaveLength(0);
  });

  it("SAM: bbox crop with maskAssetId and echoed region/job", async () => {
    const db = await makeDb();
    const cropper = new FakeCropper();
    const { handlers, media } = makeHandlers(db, { cropper });
    const { userId, projectId } = await seedSource(db, media);
    const input = emptyProjectInput("Test dress", "Africa/Accra");
    input.template = { id: "tpl_test", version: 1 };
    input.fabric.sourceAssetId = "ast_src";
    await saveDraft(db, userId, projectId, { expectedDraftVersion: 1, input });
    const frozen = await freezeRevision(db, userId, projectId, KEY("freeze-sam"), {
      expectedDraftVersion: 2,
      expectedProjectVersion: 2,
    });
    const now = Date.now();
    await db
      .prepare(
        "INSERT INTO ai_jobs (id, owner_user_id, project_id, revision_id, type, idempotency_key, request_hash, state, stage, attempt_count, workflow_id, result_json, error_code, retryable, reserved_credits, cancel_requested_at, deadline_at, created_at, updated_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "job_sam1",
        userId,
        projectId,
        frozen.revision.id,
        "analyze_fabric",
        KEY("job-sam-row"),
        "hash",
        "completed",
        null,
        1,
        null,
        JSON.stringify({
          type: "analyze_fabric",
          sourceAssetId: "ast_src",
          segmentation: {
            status: "completed",
            regions: [
              {
                id: "r1",
                maskAssetId: "ast_mask",
                bbox: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 },
              },
            ],
            errorCode: null,
          },
          observations: [],
        }),
        null,
        0,
        0,
        null,
        now + 60000,
        now,
        now,
        now,
      )
      .run();
    const res = await handlers.fabricSelection(
      jsonReq("user_a", KEY("sam-1"), {
        sourceAssetId: "ast_src",
        method: "sam",
        analysisJobId: "job_sam1",
        regionId: "r1",
      }),
      projectId,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.selection).toEqual({
      method: "sam",
      sourceAssetId: "ast_src",
      cropAssetId: body.data.asset.id,
      maskAssetId: "ast_mask",
      regionId: "r1",
      analysisJobId: "job_sam1",
    });
    expect(cropper.calls[0]?.rect).toEqual({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 });
    const row = await db
      .prepare("SELECT * FROM assets WHERE id = ?")
      .bind(body.data.asset.id)
      .first<{ origin_job_id: string | null }>();
    expect(row?.origin_job_id).toBe("job_sam1");

    const missingRegion = await handlers.fabricSelection(
      jsonReq("user_a", KEY("sam-2"), {
        sourceAssetId: "ast_src",
        method: "sam",
        analysisJobId: "job_sam1",
        regionId: "nope",
      }),
      projectId,
    );
    expect(missingRegion.status).toBe(400);
    expect((await missingRegion.json()).error.code).toBe("INVALID_INPUT");
  });

  it("cross-owner project, asset, and job return 404", async () => {
    const db = await makeDb();
    const { handlers, media } = makeHandlers(db);
    const { projectId } = await seedSource(db, media);
    const body = {
      sourceAssetId: "ast_src",
      method: "manual_crop",
      crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
    };
    const crossProject = await handlers.fabricSelection(
      jsonReq("user_b", KEY("x-1"), body),
      projectId,
    );
    expect(crossProject.status).toBe(404);
    const crossAsset = await handlers.fabricSelection(
      jsonReq("user_a", KEY("x-2"), { ...body, sourceAssetId: "ast_missing" }),
      projectId,
    );
    expect(crossAsset.status).toBe(404);
    const crossJob = await handlers.fabricSelection(
      jsonReq("user_a", KEY("x-3"), {
        sourceAssetId: "ast_src",
        method: "sam",
        analysisJobId: "job_other",
        regionId: "r1",
      }),
      projectId,
    );
    expect(crossJob.status).toBe(404);
  });

  it("idempotent replay returns original with 200 and cropper called once", async () => {
    const db = await makeDb();
    const cropper = new FakeCropper();
    const { handlers, media } = makeHandlers(db, { cropper });
    const { projectId } = await seedSource(db, media);
    const makeReq = () =>
      jsonReq("user_a", KEY("replay-1"), {
        sourceAssetId: "ast_src",
        method: "manual_crop",
        crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
      });
    const first = await handlers.fabricSelection(makeReq(), projectId);
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    const second = await handlers.fabricSelection(makeReq(), projectId);
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.data).toEqual(firstBody.data);
    expect(cropper.calls).toHaveLength(1);
  });

  it("unconfigured cropper fails closed with FEATURE_UNAVAILABLE", async () => {
    const db = await makeDb();
    const { handlers, media } = makeHandlers(db, { cropper: undefined });
    // makeHandlers spreads cropper: undefined explicitly, overriding default
    const { projectId } = await seedSource(db, media);
    const res = await handlers.fabricSelection(
      jsonReq("user_a", KEY("unconf-1"), {
        sourceAssetId: "ast_src",
        method: "manual_crop",
        crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
      }),
      projectId,
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("FEATURE_UNAVAILABLE");
  });

  it("oversize source is rejected before cropping", async () => {
    const db = await makeDb();
    const cropper = new FakeCropper();
    const { handlers, media } = makeHandlers(db, { cropper });
    const { projectId } = await seedSource(db, media, "user_a", { widthPx: 12001, heightPx: 10 });
    const res = await handlers.fabricSelection(
      jsonReq("user_a", KEY("oversize-1"), {
        sourceAssetId: "ast_src",
        method: "manual_crop",
        crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
      }),
      projectId,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_INPUT");
    expect(body.error.message).toContain("12000");
    expect(cropper.calls).toHaveLength(0);
  });
});

describe("createImagesCropper trim conversion", () => {
  it("converts normalized rect to pixel trim using source dimensions", async () => {
    const seen: { transform?: unknown; format?: string } = {};
    const binding: ImagesBindingLike = {
      input: () => ({
        transform: (t) => {
          seen.transform = t;
          return {
            output: async (opts) => {
              seen.format = opts.format;
              return {
                image: () =>
                  new ReadableStream<Uint8Array>({
                    start(c) {
                      c.enqueue(JPEG);
                      c.close();
                    },
                  }),
              };
            },
          };
        },
      }),
    };
    const cropper = createImagesCropper(binding);
    const out = await cropper.crop({
      bytes: PNG,
      mime: "image/png",
      widthPx: 1000,
      heightPx: 500,
      rect: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
    });
    expect(seen.transform).toEqual({ trim: { top: 100, left: 100, width: 500, height: 200 } });
    expect(seen.format).toBe("image/jpeg");
    expect(out).toEqual(JPEG);
  });

  it("transform failure maps to PROVIDER_UNAVAILABLE", async () => {
    const binding: ImagesBindingLike = {
      input: () => ({
        transform: () => ({
          output: async () => {
            throw new Error("images down");
          },
        }),
      }),
    };
    const cropper = createImagesCropper(binding);
    await expect(
      cropper.crop({
        bytes: PNG,
        mime: "image/png",
        widthPx: 100,
        heightPx: 100,
        rect: { x: 0, y: 0, width: 0.5, height: 0.5 },
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });
});
