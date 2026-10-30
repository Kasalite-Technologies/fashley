import { describe, expect, it } from "vitest";
import { designMetadata, type DesignPreferences } from "./design-result";

describe("generated design metadata", () => {
  it("keeps shoe metadata from the generation snapshot when preferences change", () => {
    const controls: DesignPreferences = { kind: "shoes", category: "Sneaker", occasion: "Everyday", style: "Sporty", hardware: "Gold", notes: "" };
    const snapshot = { ...controls };
    controls.category = "Boot";
    controls.hardware = "Silver";
    expect(designMetadata(snapshot)).toEqual({ category: "Shoe · Sneaker", occasion: "Everyday", style: "Sporty · Gold hardware" });
  });
  it("keeps bag metadata from the generation snapshot when preferences change", () => {
    const controls: DesignPreferences = { kind: "bags", category: "Crossbody", occasion: "Party", style: "Elegant", hardware: "None", notes: "" };
    const snapshot = { ...controls };
    controls.category = "Clutch";
    controls.style = "Statement";
    expect(designMetadata(snapshot)).toEqual({ category: "Bag · Crossbody", occasion: "Party", style: "Elegant · None hardware" });
  });
});