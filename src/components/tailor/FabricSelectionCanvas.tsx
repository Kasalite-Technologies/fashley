import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FabricAnalysisRegion {
  id: string;
  bbox: NormalizedRect;
  maskAssetId: string;
}

export interface FabricAnalysis {
  analysisJobId: string;
  regions: FabricAnalysisRegion[];
}

export type FabricSelectionRequest =
  | { sourceAssetId: string; method: "sam"; analysisJobId: string; regionId: string }
  | { sourceAssetId: string; method: "manual_crop"; crop: NormalizedRect };

export type FabricSelectionState =
  | { method: "sam"; regionId: string | null }
  | { method: "manual_crop"; crop?: NormalizedRect | null }
  | null;

export const WHOLE_PHOTO_CROP: NormalizedRect = { x: 0, y: 0, width: 1, height: 1 };
const MIN_CROP_SIZE = 0.05;
const KEY_STEP = 0.01;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function clampCrop(crop: NormalizedRect): NormalizedRect {
  const width = Math.min(
    1,
    Math.max(MIN_CROP_SIZE, Number.isFinite(crop.width) ? crop.width : MIN_CROP_SIZE),
  );
  const height = Math.min(
    1,
    Math.max(MIN_CROP_SIZE, Number.isFinite(crop.height) ? crop.height : MIN_CROP_SIZE),
  );
  return {
    width,
    height,
    x: Math.min(1 - width, clamp01(crop.x)),
    y: Math.min(1 - height, clamp01(crop.y)),
  };
}

export function pointerToNormalized(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  };
}

export function bboxToOverlayStyle(bbox: NormalizedRect): CSSProperties {
  const width = clamp01(bbox.width);
  const height = clamp01(bbox.height);
  const x = Math.min(clamp01(bbox.x), 1 - width);
  const y = Math.min(clamp01(bbox.y), 1 - height);
  return {
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    width: `${width * 100}%`,
    height: `${height * 100}%`,
  };
}

function moveCrop(crop: NormalizedRect, dx: number, dy: number): NormalizedRect {
  return clampCrop({ ...crop, x: crop.x + dx, y: crop.y + dy });
}

function resizeCrop(crop: NormalizedRect, dw: number, dh: number): NormalizedRect {
  return clampCrop({ ...crop, width: crop.width + dw, height: crop.height + dh });
}

type DragState = {
  mode: "move" | "resize";
  startPointer: { x: number; y: number };
  startCrop: NormalizedRect;
};

export function FabricSelectionCanvas({
  sourceAssetId,
  imageSrc,
  imageAlt = "Your uploaded fabric",
  analysis,
  selection,
  onSelect,
  disabled,
  manualCropDisabled,
}: {
  sourceAssetId: string;
  imageSrc: string;
  imageAlt?: string;
  analysis?: FabricAnalysis | null;
  selection?: FabricSelectionState;
  onSelect: (request: FabricSelectionRequest) => void;
  disabled?: boolean;
  manualCropDisabled?: boolean;
}) {
  const regions = analysis?.regions ?? [];
  const hasRegions = Boolean(analysis && regions.length > 0);
  const [mode, setMode] = useState<"regions" | "manual">(hasRegions ? "regions" : "manual");
  const effectiveMode = hasRegions ? mode : "manual";
  const initialCrop =
    selection?.method === "manual_crop" && selection.crop
      ? clampCrop(selection.crop)
      : { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
  const [crop, setCrop] = useState<NormalizedRect>(initialCrop);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(
    selection?.method === "sam" ? selection.regionId : null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    if (hasRegions) setMode("regions");
  }, [hasRegions, analysis?.analysisJobId]);

  useEffect(() => {
    if (selection?.method === "sam") setSelectedRegionId(selection.regionId);
  }, [selection]);

  const manualDisabled = Boolean(disabled || manualCropDisabled);

  function emitSam(regionId: string) {
    if (disabled || !analysis) return;
    setSelectedRegionId(regionId);
    onSelect({ sourceAssetId, method: "sam", analysisJobId: analysis.analysisJobId, regionId });
  }

  function emitManual(nextCrop: NormalizedRect) {
    if (manualDisabled) return;
    const clamped = clampCrop(nextCrop);
    setCrop(clamped);
    onSelect({ sourceAssetId, method: "manual_crop", crop: clamped });
  }

  function pointerNormalized(event: PointerEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return pointerToNormalized(event.clientX, event.clientY, rect);
  }

  function handleCropPointerDown(event: PointerEvent<HTMLDivElement>, dragMode: "move" | "resize") {
    if (manualDisabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { mode: dragMode, startPointer: pointerNormalized(event), startCrop: crop };
  }

  function handleCropPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || manualDisabled) return;
    const current = pointerNormalized(event);
    const dx = current.x - drag.startPointer.x;
    const dy = current.y - drag.startPointer.y;
    setCrop(
      drag.mode === "move" ? moveCrop(drag.startCrop, dx, dy) : resizeCrop(drag.startCrop, dx, dy),
    );
  }

  function endDrag() {
    dragRef.current = null;
  }

  function handleCropKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (manualDisabled) return;
    const step = KEY_STEP;
    let next: NormalizedRect | null = null;
    if (event.shiftKey) {
      if (event.key === "ArrowRight") next = resizeCrop(crop, step, 0);
      else if (event.key === "ArrowLeft") next = resizeCrop(crop, -step, 0);
      else if (event.key === "ArrowDown") next = resizeCrop(crop, 0, step);
      else if (event.key === "ArrowUp") next = resizeCrop(crop, 0, -step);
    } else {
      if (event.key === "ArrowRight") next = moveCrop(crop, step, 0);
      else if (event.key === "ArrowLeft") next = moveCrop(crop, -step, 0);
      else if (event.key === "ArrowDown") next = moveCrop(crop, 0, step);
      else if (event.key === "ArrowUp") next = moveCrop(crop, 0, -step);
    }
    if (next) {
      event.preventDefault();
      setCrop(next);
    }
  }

  const cropPercent = {
    x: Math.round(crop.x * 100),
    y: Math.round(crop.y * 100),
    width: Math.round(crop.width * 100),
    height: Math.round(crop.height * 100),
  };

  return (
    <div className="space-y-3">
      {hasRegions ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Fabric selection mode">
          <Button
            type="button"
            variant={effectiveMode === "regions" ? "default" : "outline"}
            className="min-h-11"
            aria-pressed={effectiveMode === "regions"}
            disabled={disabled}
            onClick={() => setMode("regions")}
          >
            Regions
          </Button>
          <Button
            type="button"
            variant={effectiveMode === "manual" ? "default" : "outline"}
            className="min-h-11"
            aria-pressed={effectiveMode === "manual"}
            disabled={disabled}
            onClick={() => setMode("manual")}
          >
            Manual crop
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Region picking appears here when an analysis result is available. Manual crop is always
          available.
        </p>
      )}

      <div
        ref={containerRef}
        className="relative max-h-80 overflow-hidden rounded-md border border-border"
      >
        <img src={imageSrc} alt={imageAlt} className="block max-h-80 w-full object-contain" />

        {effectiveMode === "regions" && analysis
          ? regions.map((region, index) => {
              const isSelected =
                selectedRegionId === region.id ||
                (selection?.method === "sam" && selection.regionId === region.id);
              return (
                <button
                  key={region.id}
                  type="button"
                  style={bboxToOverlayStyle(region.bbox)}
                  disabled={disabled}
                  aria-pressed={isSelected}
                  aria-label={`Select fabric region ${index + 1}`}
                  onClick={() => emitSam(region.id)}
                  className={
                    isSelected
                      ? "absolute cursor-pointer border-2 border-foreground bg-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
                      : "absolute cursor-pointer border-2 border-background bg-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
                  }
                >
                  <span className="sr-only">Fabric region {index + 1}</span>
                </button>
              );
            })
          : null}

        {effectiveMode === "manual" ? (
          <div
            role="group"
            tabIndex={manualDisabled ? -1 : 0}
            aria-label="Manual crop area. Use arrow keys to move the crop. Hold Shift and use arrow keys to resize the crop."
            aria-disabled={manualDisabled || undefined}
            style={bboxToOverlayStyle(crop)}
            onPointerDown={(e) => handleCropPointerDown(e, "move")}
            onPointerMove={handleCropPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={handleCropKeyDown}
            className="absolute touch-none border-2 border-foreground bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div
              aria-hidden="true"
              onPointerDown={(e) => {
                e.stopPropagation();
                handleCropPointerDown(e, "resize");
              }}
              onPointerMove={handleCropPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className="absolute -bottom-2 -right-2 h-5 w-5 cursor-se-resize rounded-sm border border-foreground bg-background"
            />
          </div>
        ) : null}
      </div>

      {effectiveMode === "regions" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Select a region to use it as the fabric swatch.
          </p>
          {selectedRegionId || selection?.method === "sam" ? (
            <Badge variant="secondary">Region selected</Badge>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Crop starts at {cropPercent.x} percent across and {cropPercent.y} percent down, and
            covers {cropPercent.width} percent wide by {cropPercent.height} percent high. Drag to
            move, drag the corner to resize, or focus the crop and use the arrow keys.
          </p>
          {manualCropDisabled ? (
            <p className="text-sm text-muted-foreground">
              Manual selection is not available yet. Upload a photo that is already closely cropped
              to the fabric.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-11"
              disabled={manualDisabled}
              onClick={() => emitManual(crop)}
            >
              Use this crop as swatch (manual selection)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={manualDisabled}
              onClick={() => emitManual(WHOLE_PHOTO_CROP)}
            >
              Use whole photo as swatch
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
