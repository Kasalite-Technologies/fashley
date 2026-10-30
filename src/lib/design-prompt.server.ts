import type { DesignKind } from "./design-options";

export function buildDesignPrompt(input: { kind: DesignKind; category: string; occasion: string; style: string; hardware: string; notes: string; variant: number }) {
  const { kind, category, occasion, style, hardware, notes, variant } = input;
  const garmentVariants = ["a classic, timeless silhouette", "a contemporary cut with an interesting neckline or sleeve detail", "dramatic structure such as peplum, ruffles or volume", "an unexpected modern twist such as asymmetry, cut-outs or layered panels"];
  const productVariants = ["a refined classic silhouette", "a contemporary silhouette with distinctive construction", "a bold statement silhouette with sculptural details", "an avant-garde silhouette mixing textures and unexpected proportions"];
  const subject = kind === "outfits"
    ? `a model wearing a ${category.toLowerCase()} made entirely from the reference fabric, whole garment visible head to toe, with ${garmentVariants[variant % 4] ?? garmentVariants[0]}`
    : `a single ${category.toLowerCase()} ${kind === "shoes" ? "shoe" : "handbag"} crafted from the material in the reference photo, with ${productVariants[variant % 4] ?? productVariants[0]}, ${hardware === "None" ? "no visible metal hardware" : `${hardware.toLowerCase()} metal hardware`}, realistic seams and construction, three-quarter product view, entire product visible, no person, no clothing`;
  return `Premium fashion design concept: editorial studio photograph of ${subject}. Occasion: ${occasion}. Style: ${style}. ${notes ? `Extra requests: ${notes}.` : ""} Faithfully preserve the reference material's exact colours, motifs, texture, scale and pattern. Soft neutral studio backdrop, premium magazine lighting. No text or logos.`;
}