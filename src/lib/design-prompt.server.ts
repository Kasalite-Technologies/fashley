import type { DesignKind } from "./design-options";

/* Structured prompt system for muse-image-1.0, rebuilt from published
   fashion-generation practice (Meta's image prompt guide: subject, action,
   style, background, colour, framing, mood, most important first; The
   Fabricant's prompt framework: aesthetic, subject and pose, outfit
   construction, environment, lighting, camera; The New Black's
   fabric-to-garment flow: describe the garment and the model, keep the
   fabric constant and true to the swatch).
 *
 * The old prompt passed the UI labels through almost raw ("Style:
 * Elegant."), so the model had to guess what each word should look like
 * and produced weak, inconsistent designs. Here every label the customer
 * picks is translated server-side into concrete visual language:
 *   1. fabric fidelity   (the uploaded material, reproduced exactly)
 *   2. garment brief     (per-category construction + per-variant design)
 *   3. style definition  (what the style word means visually)
 *   4. occasion styling  (how the look is finished for the occasion)
 *   5. model and pose    (outfits) or product presentation (shoes, bags)
 *   6. photography spec  (framing, lighting, backdrop)
 *   7. avoid list        (the failure modes image models fall into)
 * Prompts stay server-side; the client only sends the preference labels. */

export const FABRIC_FIDELITY_BLOCK =
  "The uploaded photo shows the exact fabric this design must be made from. Reproduce its colours, motif shapes, pattern repeat and texture faithfully across the whole design: do not recolour, simplify, invert or replace the print, do not invent a different fabric, and keep the pattern at a realistic garment scale, following seams and curves naturally.";

export const AVOID_BLOCK =
  "Avoid: distorted hands, feet or faces, extra fingers or limbs, warped or melted pattern, blurry or low-detail fabric, text, logos, watermarks, a second person, cropped head or feet, and the fabric shown only as a flat swatch in the background.";

const PHOTO_BLOCK_OUTFIT =
  "Photorealistic editorial studio photograph, full-body vertical framing, eye-level camera, whole outfit visible from head to toe with shoes in frame, soft diffused studio lighting, plain warm-grey backdrop, sharp focus, true colours.";

const PHOTO_BLOCK_PRODUCT =
  "Photorealistic studio product photograph, three-quarter view, the whole product in frame and sharply detailed, soft diffused lighting with a soft shadow, plain warm-grey backdrop, true colours.";

/* What each outfit style word means visually. Written as garment language
   (silhouette, fit, finish), not mood words, so the model can draw it. */
const OUTFIT_STYLES: Record<string, string> = {
  Elegant:
    "refined and graceful: fluid drape, a clean neckline, a defined waist, immaculate finishing and understated jewellery",
  "Modern minimal":
    "clean architectural lines, an uncluttered silhouette, neat tailoring, no ruffles or excess volume, restrained details",
  "Bold & dramatic":
    "a statement silhouette with exaggerated volume, dramatic sleeves or layered tiers, strong presence and editorial confidence",
  Romantic:
    "soft and feminine: gentle gathers, a flowing skirt, a delicate neckline and light movement through the fabric",
  Traditional:
    "classic West African tailoring: structured, modest proportions, rich celebratory finish, the print worn head to toe with pride",
};

const SHOE_STYLES: Record<string, string> = {
  Sporty: "athletic styling: cushioned sole, breathable panels, dynamic lines, a ready-to-move feel",
  Dress: "polished and formal: sleek lines, refined finish, smart enough for a suit or an evening look",
  Casual: "relaxed everyday styling: comfortable proportions, easy finish, worn-in ease",
  Minimal: "clean and pared back: smooth surfaces, no fuss, quiet detailing",
  Statement: "bold and eye-catching: sculptural shape or oversized detail that carries the whole outfit",
};

const BAG_STYLES: Record<string, string> = {
  Elegant: "refined and polished: structured shape, graceful proportions, jewellery-like hardware",
  Minimal: "clean and pared back: smooth surfaces, hidden or minimal hardware, quiet luxury finish",
  Everyday: "practical and easy: roomy, comfortable to carry, durable finish for daily use",
  Statement: "bold and eye-catching: sculptural shape or oversized hardware that carries the whole outfit",
  Vintage: "classic retro character: structured silhouette, kiss-lock or frame closure, nostalgic finish",
};

/* Per-category garment briefs. Each variant is a genuinely different
   design of the same category (neckline, sleeves, cut, length), so a set
   of three or four results explores real options instead of re-rolling
   the same adjectives. */
const OUTFIT_BRIEFS: Record<string, string[]> = {
  Dress: [
    "an A-line midi dress with a scoop neckline, short puff sleeves and a fitted waist",
    "a wrap dress with a V-neckline, three-quarter sleeves and a flowing knee-length skirt",
    "a fit-and-flare dress with a sweetheart neckline, full sleeves and a full skirt with movement",
    "a straight column dress with a high neckline, sleeveless, falling in a clean floor-length line",
  ],
  "Skirt & blouse": [
    "a fitted peplum blouse with a high-waist pencil skirt",
    "a long-sleeve blouse with a flowing tiered maxi skirt",
    "a neat tailored blouse with an A-line midi skirt",
    "a blouse with a high collar and a wrapped floor-length skirt",
  ],
  "Two-piece set": [
    "a matching tailored top and wide-leg trousers set",
    "a co-ord blouse and flowing palazzo trousers set",
    "a structured cropped jacket top with a matching pencil skirt",
    "a relaxed shirt and easy straight trousers co-ord set",
  ],
  "Casual wear": [
    "a relaxed shirt dress with short sleeves and an easy, comfortable fit",
    "a loose two-piece of an easy shirt and comfortable trousers",
    "a simple sleeveless sundress with a gently gathered skirt",
    "a relaxed jumpsuit with a soft waist tie in the same fabric",
  ],
  "Occasion gown": [
    "a floor-length fitted gown with a defined waist and a sweeping skirt",
    "a gown with long sleeves and a flowing train",
    "a mermaid gown with a structured bodice and a flared hem",
    "a ballgown silhouette with a full layered skirt",
  ],
  Jumpsuit: [
    "a tailored wide-leg jumpsuit with a fitted bodice",
    "a relaxed jumpsuit with a wrap top and tapered legs",
    "a sleeveless jumpsuit with a defined self-fabric waist tie",
    "a jumpsuit with full sleeves and palazzo legs",
  ],
  "Men's two-piece": [
    "a tailored short-sleeve shirt with matching straight trousers",
    "a long-sleeve senator-style tunic top with matching trousers",
    "a structured shirt with a chest pocket and tapered trousers",
    "a relaxed camp-collar shirt with wide-leg trousers",
  ],
  "Men's shirt & trousers": [
    "a short-sleeve button-up shirt with tailored trousers",
    "a long-sleeve shirt with a mandarin collar and straight trousers",
    "a relaxed overshirt-style shirt with pleated trousers",
    "a fitted shirt with neat cuff detailing and slim trousers",
  ],
  "Men's traditional set": [
    "a flowing agbada-inspired wide-sleeve robe over a matching tunic and trousers",
    "a classic long buba tunic with matching sokoto trousers",
    "a grand boubou with wide sleeves over a matching inner set",
    "a tailored traditional tunic with a neat placket and matching trousers",
  ],
};

const SHOE_BRIEFS: Record<string, string[]> = {
  Sneaker: [
    "a low-top lace-up sneaker with a padded collar and a flat rubber sole",
    "a chunky-sole sneaker with layered panels and sporty lacing",
    "a sleek minimal sneaker with a slim profile and clean toe",
    "a high-top sneaker with a supportive ankle collar",
  ],
  Casual: [
    "a casual lace-up shoe with a flexible sole and rounded toe",
    "a relaxed slip-on casual shoe with a cushioned sole",
    "a casual suede-look shoe with contrast stitching",
    "an easy everyday walk shoe with a low profile and soft lining",
  ],
  Boot: [
    "an ankle boot with a sturdy sole and neat lacing",
    "a Chelsea boot with elastic side panels and a low stacked heel",
    "a lace-up boot with a chunky tread sole",
    "a sleek heeled ankle boot with a pointed toe",
  ],
  Heels: [
    "an elegant high-heel pump with a pointed toe and slim heel",
    "a strappy heeled sandal with a stiletto heel",
    "a block-heel shoe with an ankle strap, elegant and steady",
    "a heeled mule with a sculpted heel",
  ],
  Derby: [
    "a classic derby shoe with open lacing, a rounded toe and a low stacked heel",
    "a polished derby shoe with brogue-style perforated detailing",
    "a contemporary derby shoe on a chunky sole",
    "a suede derby shoe with neat stitching and a clean silhouette",
  ],
  Loafer: [
    "a slip-on loafer with an apron toe and a low heel",
    "a penny loafer with a classic strap detail",
    "a chunky-sole loafer with a modern profile",
    "a soft unstructured loafer with a flexible sole",
  ],
  Sandal: [
    "a flat sandal with wide straps and a cushioned sole",
    "a strappy sandal with a low block heel",
    "a slide sandal with a single broad strap",
    "a gladiator-style sandal with fine straps",
  ],
};

const BAG_BRIEFS: Record<string, string[]> = {
  Tote: [
    "a roomy tote bag with double handles and a structured base",
    "a soft shopper tote with long shoulder straps",
    "a structured tote with a centre divider and neat topstitching",
    "an oversized tote with a relaxed, slouchy body",
  ],
  "Top-handle": [
    "a structured top-handle bag with a flap closure",
    "a lady-like top-handle bag with a rounded body and short handle",
    "a boxy top-handle bag with sharp, tailored lines",
    "a top-handle bag with a detachable shoulder strap",
  ],
  Crossbody: [
    "a compact crossbody bag with an adjustable strap and flap closure",
    "a camera-style crossbody bag with a zip top",
    "a saddle-shaped crossbody bag with a curved flap",
    "a small crossbody bag with a chain-and-fabric strap",
  ],
  Clutch: [
    "a slim envelope clutch with a flap closure",
    "a boxy minaudière clutch with a frame closure",
    "a soft pouch clutch with a gathered top",
    "an oversized day clutch with clean folded lines",
  ],
  "Shoulder bag": [
    "a classic shoulder bag with a single strap and flap closure",
    "a crescent hobo shoulder bag with a slouchy body",
    "a baguette shoulder bag with a short strap",
    "a structured shoulder bag with a chain strap",
  ],
  Backpack: [
    "a compact backpack with a flap top and front pocket",
    "a sleek zip-top backpack with clean lines",
    "a drawstring backpack with a buckled flap",
    "a structured mini backpack with top handle",
  ],
};

/* How the look is finished for the occasion. Styling cues, kept light so
   they support the garment instead of redesigning it. */
const OCCASION_STYLING: Record<string, string> = {
  Everyday: "easy daytime styling, natural grooming and simple footwear",
  Work: "polished professional styling, neat hair, closed shoes and minimal jewellery",
  Church: "respectful, polished styling with refined accessories",
  Wedding: "celebratory guest styling, refined accessories and a dressed-up finish",
  Party: "festive styling with statement earrings and heeled sandals",
  "Formal event": "formal polish, refined accessories and elegant heels",
};

function pick<T>(table: Record<string, T>, key: string, fallback: T): T {
  return table[key] ?? fallback;
}

export function buildDesignPrompt(input: {
  kind: DesignKind;
  category: string;
  occasion: string;
  style: string;
  hardware: string;
  notes: string;
  variant: number;
}) {
  const { kind, category, occasion, style, hardware, notes, variant } = input;
  const notesBlock = notes
    ? ` Follow the customer's own design notes closely: ${notes}.`
    : "";
  const occasionLine =
    pick(OCCASION_STYLING, occasion, `styled for ${occasion.toLowerCase()}`) + ".";

  if (kind === "outfits") {
    const isMens = category.toLowerCase().startsWith("men");
    const briefs = pick(OUTFIT_BRIEFS, category, [
      `a ${category.toLowerCase()} with balanced, wearable proportions`,
    ]);
    const brief = briefs[variant % briefs.length] ?? briefs[0]!;
    const styleLine = pick(OUTFIT_STYLES, style, style.toLowerCase());
    const model = isMens
      ? "one adult man model, confident natural standing pose facing the camera, arms relaxed"
      : "one adult woman model, confident natural standing pose facing the camera, arms relaxed";
    return (
      `Fashion design concept, made to order from the customer's own fabric. ${FABRIC_FIDELITY_BLOCK} ` +
      `Show ${model}, wearing ${brief}, made entirely from that reference fabric. ` +
      `Style direction: ${styleLine}. Where the style and the garment brief conflict, follow the style for the details and the brief only for the silhouette and length. Occasion: ${occasion}: ${occasionLine}${notesBlock} ` +
      `${PHOTO_BLOCK_OUTFIT} ${AVOID_BLOCK}`
    );
  }

  const isShoe = kind === "shoes";
  const briefs = pick(isShoe ? SHOE_BRIEFS : BAG_BRIEFS, category, [
    `a ${category.toLowerCase()} with balanced, wearable proportions`,
  ]);
  const design = briefs[variant % briefs.length] ?? briefs[0]!;
  const styleLine = pick(
    isShoe ? SHOE_STYLES : BAG_STYLES,
    style,
    style.toLowerCase(),
  );
  const hardwareLine =
    hardware === "None"
      ? "no visible metal hardware"
      : `${hardware.toLowerCase()} metal hardware, placed where the design needs it (closure, eyelets, buckle or strap fittings)`;
  const subject = isShoe
    ? `a single ${category.toLowerCase()} shoe: ${design}`
    : `a single ${category.toLowerCase()} handbag: ${design}`;
  return (
    `Fashion design concept, made to order from the customer's own material. ${FABRIC_FIDELITY_BLOCK} ` +
    `Show ${subject}, crafted from the material in the reference photo, with ${hardwareLine}, realistic seams and construction. ` +
    `Style direction: ${styleLine}. Where the style and the design brief conflict, follow the style for the details and the brief only for the shape. Made for: ${occasion}.${notesBlock} ` +
    `${PHOTO_BLOCK_PRODUCT} ${AVOID_BLOCK} No person, no clothing, no second shoe or bag.`
  );
}
