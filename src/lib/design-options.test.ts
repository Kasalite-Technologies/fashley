import { describe, expect, it } from "vitest";
import { DESIGN_OPTIONS, savedCategory } from "./design-options";
import { buildDesignPrompt } from "./design-prompt.server";

describe("material design categories", () => {
  it("supports shoes independently of outfit types", () => {
    expect(DESIGN_OPTIONS.shoes.categories).toEqual(expect.arrayContaining(["Sneaker", "Casual", "Boot", "Heels"]));
    expect(savedCategory("shoes", "Derby")).toBe("Shoe · Derby");
  });
  it("supports bags independently of outfit types", () => {
    expect(savedCategory("bags", "Tote")).toBe("Bag · Tote");
    expect(DESIGN_OPTIONS.bags.categories).toContain("Crossbody");
  });
  it("preserves outfit saved categories", () => {
    expect(savedCategory("outfits", "Dress")).toBe("Dress");
  });
  it("directs shoe generation to the selected product and hardware", () => {
    const prompt = buildDesignPrompt({ kind: "shoes", category: "Derby", occasion: "Office", style: "Dress", hardware: "Gold", notes: "", variant: 1 });
    expect(prompt).toContain("derby shoe");
    expect(prompt).toContain("gold metal hardware");
    expect(prompt).not.toContain("a model wearing");
  });
  it("directs bag generation to the selected product without hardware", () => {
    const prompt = buildDesignPrompt({ kind: "bags", category: "Clutch", occasion: "Party", style: "Elegant", hardware: "None", notes: "", variant: 0 });
    expect(prompt).toContain("clutch handbag");
    expect(prompt).toContain("no visible metal hardware");
  });
});