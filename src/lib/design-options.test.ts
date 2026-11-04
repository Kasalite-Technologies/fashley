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
  it("translates style labels into concrete visual definitions", () => {
    const prompt = buildDesignPrompt({ kind: "outfits", category: "Dress", occasion: "Wedding", style: "Bold & dramatic", hardware: "Gold", notes: "", variant: 0 });
    expect(prompt).not.toContain("Style: Bold & dramatic.");
    expect(prompt).toContain("exaggerated volume");
    expect(prompt).toContain("do not recolour");
  });
  it("gives each variant a different real design of the same category", () => {
    const base = { kind: "outfits" as const, category: "Dress", occasion: "Party", style: "Elegant", hardware: "Gold", notes: "" };
    const v0 = buildDesignPrompt({ ...base, variant: 0 });
    const v1 = buildDesignPrompt({ ...base, variant: 1 });
    expect(v0).toContain("A-line midi dress");
    expect(v1).toContain("wrap dress");
    expect(v0).not.toBe(v1);
  });
  it("uses a male model and tailored briefs for menswear categories", () => {
    const prompt = buildDesignPrompt({ kind: "outfits", category: "Men's shirt & trousers", occasion: "Work", style: "Modern minimal", hardware: "Gold", notes: "", variant: 0 });
    expect(prompt).toContain("one adult man model");
    expect(prompt).toContain("button-up shirt with tailored trousers");
  });
  it("includes the avoid list and customer notes", () => {
    const prompt = buildDesignPrompt({ kind: "outfits", category: "Jumpsuit", occasion: "Party", style: "Romantic", hardware: "Gold", notes: "long sleeves", variant: 2 });
    expect(prompt).toContain("extra fingers");
    expect(prompt).toContain("long sleeves");
  });
});