import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDb } from "./db";
import { ensureLocalUser, createConsent } from "./identity";
import { createProject } from "./projects";
import { defaultConfig } from "./config";
import { InMemoryMediaStore } from "./media";
import {
  createUploadIntent,
  receiveUploadContent,
  completeUpload,
  getUploadStatus,
  getOwnedAssetRow,
} from "./uploads";
const te = new TextEncoder();
function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function u32be(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typed = concatBytes([te.encode(type), data]);
  return concatBytes([u32be(data.length), typed, u32be(crc32(typed))]);
}
function makePng(): Uint8Array {
  const ihdr = concatBytes([u32be(1), u32be(1), new Uint8Array([8, 2, 0, 0, 0])]);
  return concatBytes([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", new Uint8Array([0x78, 0x9c, 0x63, 0x60, 0, 0, 0, 2, 0, 1])),
    pngChunk("IEND", new Uint8Array(0)),
  ]);
}

const MIGRATIONS = readdirSync(join(process.cwd(), "migrations/tailor"))
  .sort()
  .map((f) => readFileSync(join(process.cwd(), "migrations/tailor", f), "utf8"));
async function makeDb() {
  const db = new InMemoryDb();
  for (const sql of MIGRATIONS) await db.exec(sql);
  return db;
}
const actor = (s: string) => ({ subject: s, displayName: s, email: `${s}@example.invalid` });
const KEY = (n: string) => `test-key-${n}-1234567890`;

async function seed() {
  const db = await makeDb();
  const { userId } = await ensureLocalUser(db, actor("owner"));
  const { userId: otherUserId } = await ensureLocalUser(db, actor("other"));
  const { detail } = await createProject(db, userId, KEY("create"), {
    title: "Test dress",
    template: { id: "tpl_test", version: 1 },
    occasion: null,
    deadline: null,
    fit: "regular",
    timezone: "Africa/Accra",
  });
  const projectId = detail.project.id;
  const { consent } = await createConsent(db, userId, KEY("consent"), {
    purpose: "ai_fabric",
    policyVersion: defaultConfig.policyVersion,
    projectId,
  });
  return { db, userId, otherUserId, projectId, consentId: consent.id };
}

describe("uploads", () => {
  it("intent -> content -> complete happy path stores a ready asset", async () => {
    const { db, userId, projectId, consentId } = await seed();
    const media = new InMemoryMediaStore();
    const png = makePng();
    const intent = await createUploadIntent(
      db,
      userId,
      projectId,
      KEY("intent"),
      { kind: "fabric_source", mime: "image/png", bytes: png.length, consentId },
      defaultConfig,
    );
    expect(intent.maxBytes).toBe(10_485_760);
    expect(intent.putUrl).toBe(
      `/api/tailor/projects/${projectId}/uploads/${intent.uploadId}/content`,
    );
    expect(Number.isNaN(Date.parse(intent.expiresAt))).toBe(false);

    const received = await receiveUploadContent(db, media, userId, projectId, intent.uploadId, png);
    expect(received.status).toBe("received");
    expect(received.asset).toBeNull();
    expect(media.objects.has(`quarantine/${projectId}/${intent.uploadId}`)).toBe(true);

    const done = await completeUpload(
      db,
      media,
      userId,
      projectId,
      intent.uploadId,
      KEY("complete"),
    );
    expect(done.status).toBe("ready");
    expect(done.asset).toMatchObject({
      projectId,
      kind: "fabric_source",
      mime: "image/png",
      widthPx: 1,
      heightPx: 1,
      parentAssetId: null,
    });
    const assetId = done.asset!.id;
    expect(media.objects.has(`private/${projectId}/${assetId}`)).toBe(true);
    expect(media.objects.has(`quarantine/${projectId}/${intent.uploadId}`)).toBe(false);
    const row = await getOwnedAssetRow(db, userId, assetId);
    expect(row.state).toBe("ready");
    expect(row.object_key).toBe(`private/${projectId}/${assetId}`);
    expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
    const status = await getUploadStatus(db, userId, projectId, intent.uploadId);
    expect(status).toEqual(done);

    const replay = await completeUpload(
      db,
      media,
      userId,
      projectId,
      intent.uploadId,
      KEY("complete"),
    );
    expect(replay).toEqual(done);
  });

  it("rejects wrong-owner access with NOT_FOUND", async () => {
    const { db, userId, otherUserId, projectId, consentId } = await seed();
    const media = new InMemoryMediaStore();
    const png = makePng();
    const intent = await createUploadIntent(
      db,
      userId,
      projectId,
      KEY("intent-owner"),
      { kind: "fabric_source", mime: "image/png", bytes: png.length, consentId },
      defaultConfig,
    );
    await expect(
      getUploadStatus(db, otherUserId, projectId, intent.uploadId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      receiveUploadContent(db, media, otherUserId, projectId, intent.uploadId, png),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getOwnedAssetRow(db, otherUserId, "ast_missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("requires an active consent with the matching purpose", async () => {
    const { db, userId, projectId } = await seed();
    await expect(
      createUploadIntent(
        db,
        userId,
        projectId,
        KEY("intent-noconsent"),
        { kind: "fabric_source", mime: "image/png", bytes: 10, consentId: "cns_missing" },
        defaultConfig,
      ),
    ).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
  });

  it("rejects tampered content and records a rejected status", async () => {
    const { db, userId, projectId, consentId } = await seed();
    const media = new InMemoryMediaStore();
    const png = makePng();
    const intent = await createUploadIntent(
      db,
      userId,
      projectId,
      KEY("intent-tamper"),
      { kind: "fabric_source", mime: "image/png", bytes: png.length, consentId },
      defaultConfig,
    );
    const tampered = new Uint8Array(png);
    tampered[29] = tampered[29]! ^ 0xff;
    await expect(
      receiveUploadContent(db, media, userId, projectId, intent.uploadId, tampered),
    ).rejects.toMatchObject({ code: "UPLOAD_REJECTED" });
    const status = await getUploadStatus(db, userId, projectId, intent.uploadId);
    expect(status.status).toBe("rejected");
    expect(status.error).toEqual({ code: "UPLOAD_REJECTED", message: "Upload was rejected." });
    expect(status.asset).toBeNull();
  });

  it("rejects content whose size differs from the declared size", async () => {
    const { db, userId, projectId, consentId } = await seed();
    const media = new InMemoryMediaStore();
    const png = makePng();
    const intent = await createUploadIntent(
      db,
      userId,
      projectId,
      KEY("intent-size"),
      { kind: "fabric_source", mime: "image/png", bytes: png.length + 1, consentId },
      defaultConfig,
    );
    await expect(
      receiveUploadContent(db, media, userId, projectId, intent.uploadId, png),
    ).rejects.toMatchObject({ code: "UPLOAD_REJECTED" });
  });

  it("blocks person uploads when the capability is disabled", async () => {
    const { db, userId, projectId, consentId } = await seed();
    await expect(
      createUploadIntent(
        db,
        userId,
        projectId,
        KEY("intent-person"),
        { kind: "person_source", mime: "image/png", bytes: 10, consentId },
        defaultConfig,
      ),
    ).rejects.toMatchObject({ code: "FEATURE_UNAVAILABLE" });
  });
});
