import type { Db } from "./db";
import { err, newId, notFound, TailorError } from "./errors";
import { nowMs, toIso } from "./util";
import { checkReceipt, storeReceipt } from "./receipts";
import { getOwnedProject } from "./projects";
import { getActiveConsent } from "./identity";
import type { MediaStore, TailorConfig } from "./config";
import type { Asset } from "../contracts";
import { MAX_IMAGE_BYTES, sanitizeImage } from "./media";

export interface UploadRow {
  id: string;
  project_id: string;
  owner_user_id: string;
  kind: string;
  quarantine_key: string;
  declared_mime: string;
  declared_bytes: number;
  status: string;
  asset_id: string | null;
  expires_at: number;
  failure_code: string | null;
  created_at: number;
  updated_at: number;
}

export interface AssetRow {
  id: string;
  project_id: string;
  owner_user_id: string;
  kind: string;
  object_key: string;
  mime: string;
  bytes: number;
  width_px: number;
  height_px: number;
  sha256: string;
  parent_asset_id: string | null;
  consent_id: string | null;
  origin_job_id: string | null;
  state: string;
  retention_expires_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface UploadStatusDTO {
  uploadId: string;
  status: string;
  asset: Asset | null;
  error: { code: string; message: string } | null;
}

export function toAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind,
    mime: row.mime as Asset["mime"],
    bytes: row.bytes,
    widthPx: row.width_px,
    heightPx: row.height_px,
    parentAssetId: row.parent_asset_id,
    createdAt: toIso(row.created_at),
  };
}

async function loadUpload(
  db: Db,
  userId: string,
  projectId: string,
  uploadId: string,
): Promise<UploadRow> {
  const row = await db
    .prepare("SELECT * FROM uploads WHERE id = ? AND project_id = ? AND owner_user_id = ?")
    .bind(uploadId, projectId, userId)
    .first<UploadRow>();
  if (!row) throw notFound();
  return row;
}

async function loadAssetById(db: Db, assetId: string): Promise<AssetRow | null> {
  return db.prepare("SELECT * FROM assets WHERE id = ?").bind(assetId).first<AssetRow>();
}

async function toStatusDTO(db: Db, row: UploadRow): Promise<UploadStatusDTO> {
  const assetRow = row.asset_id ? await loadAssetById(db, row.asset_id) : null;
  return {
    uploadId: row.id,
    status: row.status,
    asset: assetRow ? toAsset(assetRow) : null,
    error:
      row.status === "rejected"
        ? { code: row.failure_code ?? "UPLOAD_REJECTED", message: "Upload was rejected." }
        : null,
  };
}

async function setStatus(
  db: Db,
  uploadId: string,
  status: string,
  failureCode: string | null,
  assetId?: string | null,
): Promise<void> {
  if (assetId !== undefined) {
    await db
      .prepare(
        "UPDATE uploads SET status = ?, failure_code = ?, asset_id = ?, updated_at = ? WHERE id = ?",
      )
      .bind(status, failureCode, assetId, nowMs(), uploadId)
      .run();
  } else {
    await db
      .prepare("UPDATE uploads SET status = ?, failure_code = ?, updated_at = ? WHERE id = ?")
      .bind(status, failureCode, nowMs(), uploadId)
      .run();
  }
}

export async function createUploadIntent(
  db: Db,
  userId: string,
  projectId: string,
  idempotencyKey: string,
  req: { kind: "fabric_source" | "person_source"; mime: string; bytes: number; consentId: string },
  config: TailorConfig,
): Promise<{ uploadId: string; putUrl: string; expiresAt: string; maxBytes: number }> {
  await getOwnedProject(db, userId, projectId);
  if (req.kind === "person_source" && !config.capabilities.personUpload)
    throw err("FEATURE_UNAVAILABLE", "Person photo upload is not available.");
  if (req.kind !== "fabric_source" && req.kind !== "person_source")
    throw err("INVALID_INPUT", "Upload kind is not supported.");
  await getActiveConsent(
    db,
    userId,
    req.consentId,
    req.kind === "person_source" ? "ai_person" : "ai_fabric",
  );
  const payload = { projectId, ...req };
  const replay = await checkReceipt(db, userId, "create_upload_intent", idempotencyKey, payload);
  if (replay)
    return replay.response as {
      uploadId: string;
      putUrl: string;
      expiresAt: string;
      maxBytes: number;
    };
  const uploadId = newId("upl");
  const now = nowMs();
  const expiresAtMs = now + 3_600_000;
  await db
    .prepare(
      "INSERT INTO uploads (id, project_id, owner_user_id, kind, quarantine_key, declared_mime, declared_bytes, status, asset_id, expires_at, failure_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      uploadId,
      projectId,
      userId,
      req.kind,
      `quarantine/${projectId}/${uploadId}`,
      req.mime,
      req.bytes,
      "pending",
      null,
      expiresAtMs,
      null,
      now,
      now,
    )
    .run();
  const result = {
    uploadId,
    putUrl: `/api/tailor/projects/${projectId}/uploads/${uploadId}/content`,
    expiresAt: toIso(expiresAtMs),
    maxBytes: MAX_IMAGE_BYTES,
  };
  await storeReceipt(db, userId, "create_upload_intent", idempotencyKey, payload, result);
  return result;
}

export async function receiveUploadContent(
  db: Db,
  media: MediaStore,
  userId: string,
  projectId: string,
  uploadId: string,
  bytes: Uint8Array,
): Promise<UploadStatusDTO> {
  const row = await loadUpload(db, userId, projectId, uploadId);
  if (row.status === "ready" || row.status === "rejected" || row.status === "expired")
    throw err("UPLOAD_REJECTED", "Upload is already finalized.");
  if (row.status !== "pending" && row.status !== "received")
    throw err("UPLOAD_REJECTED", "Upload cannot receive content in its current state.");
  if (row.expires_at < nowMs()) {
    await setStatus(db, uploadId, "expired", row.failure_code);
    throw err("UPLOAD_REJECTED", "Upload intent has expired.");
  }
  if (bytes.length !== row.declared_bytes || bytes.length > MAX_IMAGE_BYTES) {
    await setStatus(db, uploadId, "rejected", "UPLOAD_REJECTED");
    throw err("UPLOAD_REJECTED", "Upload size does not match the declared size.");
  }
  let sanitized;
  try {
    sanitized = await sanitizeImage(bytes, row.declared_mime);
  } catch (e) {
    if (e instanceof TailorError) {
      await setStatus(db, uploadId, "rejected", e.code);
    }
    throw e;
  }
  await media.putPrivate(row.quarantine_key, sanitized.bytes);
  await setStatus(db, uploadId, "received", null);
  return toStatusDTO(db, { ...row, status: "received", failure_code: null });
}

export async function completeUpload(
  db: Db,
  media: MediaStore,
  userId: string,
  projectId: string,
  uploadId: string,
  idempotencyKey: string,
): Promise<UploadStatusDTO> {
  const payload = { projectId, uploadId };
  const replay = await checkReceipt(db, userId, "complete_upload", idempotencyKey, payload);
  if (replay) return replay.response as UploadStatusDTO;
  const row = await loadUpload(db, userId, projectId, uploadId);
  if (row.status === "ready" && row.asset_id) {
    const dto = await toStatusDTO(db, row);
    await storeReceipt(db, userId, "complete_upload", idempotencyKey, payload, dto);
    return dto;
  }
  if (row.status === "rejected" || row.status === "expired")
    throw err("UPLOAD_REJECTED", "Upload was rejected.");
  if (row.status !== "received")
    throw err("ASSET_NOT_READY", "Upload content has not been received.");
  if (row.expires_at < nowMs()) {
    await setStatus(db, uploadId, "expired", row.failure_code);
    throw err("UPLOAD_REJECTED", "Upload intent has expired.");
  }
  let quarantined: Uint8Array;
  try {
    quarantined = await media.getPrivate(row.quarantine_key);
  } catch {
    throw err("ASSET_NOT_READY", "Upload content is not available.");
  }
  let sanitized;
  try {
    sanitized = await sanitizeImage(quarantined, row.declared_mime);
  } catch (e) {
    if (e instanceof TailorError) await setStatus(db, uploadId, "rejected", e.code);
    throw e;
  }
  const assetId = newId("ast");
  const objectKey = `private/${projectId}/${assetId}`;
  const now = nowMs();
  await media.putPrivate(objectKey, sanitized.bytes);
  await db
    .prepare(
      "INSERT INTO assets (id, project_id, owner_user_id, kind, object_key, mime, bytes, width_px, height_px, sha256, parent_asset_id, consent_id, origin_job_id, state, retention_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      assetId,
      projectId,
      userId,
      row.kind,
      objectKey,
      sanitized.mime,
      sanitized.bytes.length,
      sanitized.widthPx,
      sanitized.heightPx,
      sanitized.sha256,
      null,
      null,
      null,
      "ready",
      null,
      now,
      now,
    )
    .run();
  await setStatus(db, uploadId, "ready", null, assetId);
  await media.deletePrivate(row.quarantine_key);
  const assetRow = await loadAssetById(db, assetId);
  const dto: UploadStatusDTO = {
    uploadId,
    status: "ready",
    asset: assetRow ? toAsset(assetRow) : null,
    error: null,
  };
  await storeReceipt(db, userId, "complete_upload", idempotencyKey, payload, dto);
  return dto;
}

export async function getUploadStatus(
  db: Db,
  userId: string,
  projectId: string,
  uploadId: string,
): Promise<UploadStatusDTO> {
  const row = await loadUpload(db, userId, projectId, uploadId);
  if ((row.status === "pending" || row.status === "received") && row.expires_at < nowMs()) {
    await setStatus(db, uploadId, "expired", row.failure_code);
    return toStatusDTO(db, { ...row, status: "expired" });
  }
  return toStatusDTO(db, row);
}

export async function getOwnedAssetRow(db: Db, userId: string, assetId: string): Promise<AssetRow> {
  const row = await db
    .prepare("SELECT * FROM assets WHERE id = ? AND owner_user_id = ? AND state = ?")
    .bind(assetId, userId, "ready")
    .first<AssetRow>();
  if (!row) throw notFound();
  return row;
}
