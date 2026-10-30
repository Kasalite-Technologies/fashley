export type DesignKind = "outfits" | "shoes" | "bags";

export const DESIGN_OPTIONS = {
  outfits: {
    title: "Outfit design", label: "Outfit", material: "fabric",
    categories: ["Dress", "Skirt & blouse", "Two-piece set", "Casual wear", "Occasion gown", "Jumpsuit"],
    styles: ["Elegant", "Modern minimal", "Bold & dramatic", "Romantic", "Traditional"],
    example: "Extra details, such as long sleeves or an off-shoulder cut",
  },
  shoes: {
    title: "Shoe design", label: "Shoe type", material: "material",
    categories: ["Sneaker", "Casual", "Boot", "Heels", "Derby", "Loafer", "Sandal"],
    styles: ["Sporty", "Dress", "Casual", "Minimal", "Statement"],
    example: "Extra details, such as a block heel or contrast stitching",
  },
  bags: {
    title: "Bag design", label: "Bag type", material: "material",
    categories: ["Tote", "Top-handle", "Crossbody", "Clutch", "Shoulder bag", "Backpack"],
    styles: ["Elegant", "Minimal", "Everyday", "Statement", "Vintage"],
    example: "Extra details, such as a detachable strap or inner pockets",
  },
} satisfies Record<DesignKind, { title: string; label: string; material: string; categories: string[]; styles: string[]; example: string }>;

export const HARDWARE = ["Gold", "Silver", "Black", "None"];

export function savedCategory(kind: DesignKind, category: string) {
  return kind === "outfits" ? category : `${kind === "shoes" ? "Shoe" : "Bag"} · ${category}`;
}