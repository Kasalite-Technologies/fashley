import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FabricSelectionCanvas,
  bboxToOverlayStyle,
  clampCrop,
  pointerToNormalized,
  WHOLE_PHOTO_CROP,
} from "./FabricSelectionCanvas";

afterEach(() => cleanup());

const regions = [
  { id: "reg_1", bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }, maskAssetId: "ast_mask_1" },
  { id: "reg_2", bbox: { x: 0.5, y: 0.1, width: 0.25, height: 0.25 }, maskAssetId: "ast_mask_2" },
];

describe("clampCrop", () => {
  it("keeps a valid crop unchanged", () => {
    expect(clampCrop({ x: 0.2, y: 0.3, width: 0.4, height: 0.5 })).toEqual({
      x: 0.2,
      y: 0.3,
      width: 0.4,
      height: 0.5,
    });
  });

  it("clamps overflow so x+width and y+height stay within 1", () => {
    const result = clampCrop({ x: 0.9, y: 0.95, width: 0.5, height: 0.5 });
    expect(result.x + result.width).toBeLessThanOrEqual(1);
    expect(result.y + result.height).toBeLessThanOrEqual(1);
    expect(result).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 });
  });

  it("clamps negative and oversized values", () => {
    expect(clampCrop({ x: -1, y: -0.5, width: 2, height: 3 })).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
  });

  it("enforces a minimum size", () => {
    const result = clampCrop({ x: 0, y: 0, width: 0, height: -1 });
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it("keeps the whole-photo degenerate crop intact", () => {
    expect(clampCrop(WHOLE_PHOTO_CROP)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});

describe("pointerToNormalized", () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };
  it("converts centre and corners", () => {
    expect(pointerToNormalized(200, 100, rect)).toEqual({ x: 0.5, y: 0.5 });
    expect(pointerToNormalized(100, 50, rect)).toEqual({ x: 0, y: 0 });
    expect(pointerToNormalized(300, 150, rect)).toEqual({ x: 1, y: 1 });
  });
  it("clamps outside the image and guards zero size", () => {
    expect(pointerToNormalized(0, 0, rect)).toEqual({ x: 0, y: 0 });
    expect(pointerToNormalized(999, 999, rect)).toEqual({ x: 1, y: 1 });
    expect(pointerToNormalized(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe("bboxToOverlayStyle", () => {
  it("maps normalized bbox to percentage CSS", () => {
    expect(bboxToOverlayStyle({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 })).toEqual({
      left: "10%",
      top: "20%",
      width: "30%",
      height: "40%",
    });
  });
  it("clamps overflowing bbox inside the image", () => {
    expect(bboxToOverlayStyle({ x: 0.9, y: 0.9, width: 0.5, height: 0.5 })).toEqual({
      left: "50%",
      top: "50%",
      width: "50%",
      height: "50%",
    });
  });
  it("maps the whole photo to a full overlay", () => {
    expect(bboxToOverlayStyle(WHOLE_PHOTO_CROP)).toEqual({
      left: "0%",
      top: "0%",
      width: "100%",
      height: "100%",
    });
  });
});

describe("FabricSelectionCanvas (fixture data only)", () => {
  it("renders regions and emits the sam request shape on selection", () => {
    const onSelect = vi.fn();
    render(
      <FabricSelectionCanvas
        sourceAssetId="ast_fabric_1"
        imageSrc="/api/tailor/assets/ast_fabric_1"
        analysis={{ analysisJobId: "job_fixture_1", regions }}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByAltText("Your uploaded fabric")).toBeInTheDocument();
    const region = screen.getByRole("button", { name: "Select fabric region 2" });
    expect(region).toHaveStyle({ left: "50%", top: "10%", width: "25%", height: "25%" });
    fireEvent.click(region);
    expect(onSelect).toHaveBeenCalledWith({
      sourceAssetId: "ast_fabric_1",
      method: "sam",
      analysisJobId: "job_fixture_1",
      regionId: "reg_2",
    });
    expect(region).toHaveAttribute("aria-pressed", "true");
  });

  it("emits manual_crop shapes in manual mode, including the whole photo", () => {
    const onSelect = vi.fn();
    render(
      <FabricSelectionCanvas
        sourceAssetId="ast_fabric_1"
        imageSrc="/api/tailor/assets/ast_fabric_1"
        analysis={{ analysisJobId: "job_fixture_1", regions }}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Manual crop" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Use this crop as swatch (manual selection)" }),
    );
    expect(onSelect).toHaveBeenCalledWith({
      sourceAssetId: "ast_fabric_1",
      method: "manual_crop",
      crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use whole photo as swatch" }));
    expect(onSelect).toHaveBeenCalledWith({
      sourceAssetId: "ast_fabric_1",
      method: "manual_crop",
      crop: { x: 0, y: 0, width: 1, height: 1 },
    });
  });

  it("moves the crop with arrow keys and resizes with shift plus arrows", () => {
    const onSelect = vi.fn();
    render(
      <FabricSelectionCanvas
        sourceAssetId="ast_fabric_1"
        imageSrc="/api/tailor/assets/ast_fabric_1"
        analysis={null}
        onSelect={onSelect}
      />,
    );
    expect(screen.queryByRole("button", { name: "Manual crop" })).not.toBeInTheDocument();
    const cropArea = screen.getByRole("group", { name: /Manual crop area/ });
    fireEvent.keyDown(cropArea, { key: "ArrowRight" });
    fireEvent.keyDown(cropArea, { key: "ArrowDown", shiftKey: true });
    fireEvent.click(
      screen.getByRole("button", { name: "Use this crop as swatch (manual selection)" }),
    );
    const call = onSelect.mock.calls.at(-1)?.[0] as {
      method: string;
      crop: { x: number; y: number; width: number; height: number };
    };
    expect(call.method).toBe("manual_crop");
    expect(call.crop.x).toBeCloseTo(0.11);
    expect(call.crop.height).toBeCloseTo(0.81);
    expect(call.crop.x + call.crop.width).toBeLessThanOrEqual(1);
    expect(call.crop.y + call.crop.height).toBeLessThanOrEqual(1);
  });

  it("disables controls when disabled", () => {
    const onSelect = vi.fn();
    render(
      <FabricSelectionCanvas
        sourceAssetId="ast_fabric_1"
        imageSrc="/api/tailor/assets/ast_fabric_1"
        analysis={null}
        onSelect={onSelect}
        manualCropDisabled
      />,
    );
    expect(screen.getByRole("button", { name: "Use whole photo as swatch" })).toBeDisabled();
    expect(screen.getByText(/Manual selection is not available yet/)).toBeInTheDocument();
  });
});
