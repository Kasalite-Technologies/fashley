import type { Db } from "./db";
import { err, newId, notFound, TailorError } from "./errors";
import { checkReceipt, storeReceipt } from "./receipts";
import { getOwnedProject } from "./projects";
import { toAsset, type AssetRow } from "./uploads";
import { insertDerivedAsset } from "./jobs";
import { sanitizeImage } from "./media";
import type { ImageCropper, MediaStore, NormalizedRect } from "./config";
import { jobResultSchema, type Asset } from "../contracts";

export type FabricSelectionInput =
  | { sourceAssetId: string; method: "sam"; analysisJobId: string; regionId: string }
  | { sourceAssetId: string; method: "manual_crop"; crop: NormalizedRect };

export interface FabricSelectionResult {
  selection: {
    method: "sam" | "manual_crop";
    sourceAssetId: string;
    cropAssetId: string;
    maskAssetId: string | null;
    regionId: string | null;
    analysisJobId: string | null;
  };
  asset: Asset;
}

export interface FabricSelectionDeps {
  media?: MediaStore;
  cropper?: ImageCropper;
}

const MAX_SIDE_PX = 12_000;
const MAX_PIXELS = 100_000_000;

function assertRectWithinImage(rect: NormalizedRect): void {
  if (rect.x + rect.width > 1 || rect.y + rect.height > 1)
    throw err("INVALID_INPUT", "Crop rectangle exceeds the source image bounds.");
}

export async function createFabricSelection(
  db: Db,
  deps: FabricSelectionDeps,
  userId: string,
  projectId: string,
  idempotencyKey: string,
  req: FabricSelectionInput,
): Promise<FabricSelectionResult & { replayed: boolean }> {
  const payload = { projectId, ...req };
  const replay = await checkReceipt(db, userId, "fabric_selection", idempotencyKey, payload);
  if (replay) return { ...(replay.response as FabricSelectionResult), replayed: true };

  const project = await getOwnedProject(db, userId, projectId);
  if (project.status === "archived")
    throw err("INVALID_INPUT", "Archived projects cannot be edited.");
  if (!deps.cropper) throw err("FEATURE_UNAVAILABLE", "Image cropping is not configured.");
  if (!deps.media) throw err("FEATURE_UNAVAILABLE", "Tailor media binding is not configured.");
  const cropper = deps.cropper;
  const media = deps.media;

  const source = await db
    .prepare("SELECT * FROM assets WHERE id = ? AND project_id = ? AND owner_user_id = ?")
    .bind(req.sourceAssetId, projectId, userId)
    .first<AssetRow>();
  if (!source) throw notFound();
  if (source.kind !== "fabric_source" || source.state !== "ready")
    throw err("INVALID_INPUT", "Source asset is not a ready fabric source.");

  if (
    source.width_px > MAX_SIDE_PX ||
    source.height_px > MAX_SIDE_PX ||
    source.width_px * source.height_px > MAX_PIXELS
  )
    throw err(
      "INVALID_INPUT",
      "Source image is too large to crop (maximum 12000px per side and 100MP total).",
    );

  let rect: NormalizedRect;
  let maskAssetId: string | null = null;
  let regionId: string | null = null;
  let analysisJobId: string | null = null;

  if (req.method === "manual_crop") {
    rect = req.crop;
    assertRectWithinImage(rect);
  } else {
    const job = await db
      .prepare("SELECT * FROM ai_jobs WHERE id = ? AND owner_user_id = ? AND project_id = ?")
      .bind(req.analysisJobId, userId, projectId)
      .first<{ type: string; state: string; result_json: string | null }>();
    if (!job) throw notFound();
    if (job.type !== "analyze_fabric" || job.state !== "completed")
      throw err("INVALID_INPUT", "Fabric analysis job is not completed.");
    let parsed: unknown = null;
    try {
      parsed = job.result_json ? JSON.parse(job.result_json) : null;
    } catch {
      parsed = null;
    }
    const result = jobResultSchema.safeParse(parsed);
    if (!result.success || result.data.type !== "analyze_fabric")
      throw err("INVALID_INPUT", "Fabric analysis job result is not available.");
    if (result.data.segmentation.status !== "completed")
      throw err("INVALID_INPUT", "Fabric segmentation is not completed.");
    if (result.data.sourceAssetId !== req.sourceAssetId)
      throw err("INVALID_INPUT", "Fabric analysis job does not match the source asset.");
    const region = result.data.segmentation.regions.find((r) => r.id === req.regionId);
    if (!region) throw err("INVALID_INPUT", "Fabric region was not found in the analysis job.");
    rect = region.bbox;
    assertRectWithinImage(rect);
    maskAssetId = region.maskAssetId;
    regionId = region.id;
    analysisJobId = req.analysisJobId;
  }

  const sourceBytes = await media.getPrivate(source.object_key);
  let sanitizedSource;
  try {
    sanitizedSource = await sanitizeImage(sourceBytes, source.mime);
  } catch (e) {
    if (e instanceof TailorError) throw e;
    throw err("INVALID_INPUT", "Source image could not be read.");
  }
  if (
    sanitizedSource.widthPx > MAX_SIDE_PX ||
    sanitizedSource.heightPx > MAX_SIDE_PX ||
    sanitizedSource.widthPx * sanitizedSource.heightPx > MAX_PIXELS
  )
    throw err(
      "INVALID_INPUT",
      "Source image is too large to crop (maximum 12000px per side and 100MP total).",
    );

  let cropped: Uint8Array;
  try {
    cropped = await cropper.crop({
      bytes: sanitizedSource.bytes,
      mime: sanitizedSource.mime,
      widthPx: sanitizedSource.widthPx,
      heightPx: sanitizedSource.heightPx,
      rect,
    });
  } catch (e) {
    if (e instanceof TailorError) throw e;
    throw err("PROVIDER_UNAVAILABLE", "Image cropping failed.");
  }

  let sanitized;
  try {
    sanitized = await sanitizeImage(cropped, "image/jpeg");
  } catch {
    throw err("PROVIDER_UNAVAILABLE", "Image cropping failed.");
  }

  const cropAssetId = newId("ast");
  await media.putPrivate(`private/${projectId}/${cropAssetId}`, sanitized.bytes);
  const assetRow = await insertDerivedAsset(db, {
    id: cropAssetId,
    projectId,
    ownerUserId: userId,
    kind: "fabric_crop",
    mime: sanitized.mime,
    bytes: sanitized.bytes.length,
    widthPx: sanitized.widthPx,
    heightPx: sanitized.heightPx,
    sha256: sanitized.sha256,
    parentAssetId: source.id,
    originJobId: analysisJobId,
  });

  const resultBody: FabricSelectionResult = {
    selection: {
      method: req.method,
      sourceAssetId: req.sourceAssetId,
      cropAssetId,
      maskAssetId,
      regionId,
      analysisJobId,
    },
    asset: toAsset(assetRow),
  };
  await storeReceipt(db, userId, "fabric_selection", idempotencyKey, payload, resultBody);
  return { ...resultBody, replayed: false };
}
