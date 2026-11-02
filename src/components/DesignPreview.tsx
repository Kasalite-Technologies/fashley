import { Link } from "@tanstack/react-router";
import { useState } from "react";
import "@/styles/workspace.css";
import type { DesignKind } from "@/lib/design-options";
import waxFabric from "@/assets/previews/0.jpg";
import dress from "@/assets/previews/1.jpg";
import jumpsuit from "@/assets/previews/2.jpg";
import skirt from "@/assets/previews/3.jpg";
import kente from "@/assets/previews/shoe-fabric.jpg";
import boot from "@/assets/previews/shoe-boot.jpg";
import sneaker from "@/assets/previews/shoe-sneaker.jpg";
import adire from "@/assets/previews/bag-fabric.jpg";
import tote from "@/assets/previews/bag-tote.jpg";
import clutch from "@/assets/previews/bag-clutch.jpg";
import weddingLook from "@/assets/previews/wardrobe-wedding.jpg";
import churchHeel from "@/assets/previews/4.jpg";
import officeBag from "@/assets/previews/6.jpg";

type Step = [string, string];
type Preview = {
  eyebrow: string;
  title: string;
  intro: string;
  fabric: { src: string; alt: string; caption: string };
  designs: { src: string; alt: string; caption: string }[];
  steps: Step[];
};

const previews: Record<DesignKind, Preview> = {
  outfits: {
    eyebrow: "Outfit studio",
    title: "A fabric you love. An outfit of your own.",
    intro: "Take a photo of your wax print. See it as a dress, a jumpsuit, a skirt set, and more.",
    fabric: {
      src: waxFabric,
      alt: "Turquoise, yellow and magenta wax print fabric",
      caption: "Your wax print",
    },
    designs: [
      { src: dress, alt: "Dress in the example wax print", caption: "Fitted dress" },
      { src: jumpsuit, alt: "Jumpsuit in the example wax print", caption: "Jumpsuit" },
      { src: skirt, alt: "Skirt set in the example wax print", caption: "Skirt set" },
    ],
    steps: [
      ["Photograph your fabric", "Lay the cloth flat in good light and take one clear photo."],
      ["Pick a cut and occasion", "Choose a style, such as kaba and slit or a short dress."],
      ["Compare the outfits", "See up to four outfits and save the one you like."],
    ],
  },
  shoes: {
    eyebrow: "Shoe studio",
    title: "Your material. A different kind of sole.",
    intro: "Choose a shoe type and hardware. See your print on boots and sneakers.",
    fabric: { src: kente, alt: "Folded gold, green and red kente cloth", caption: "Your kente" },
    designs: [
      { src: boot, alt: "Ankle boot in kente with brown leather trim", caption: "Ankle boot" },
      { src: sneaker, alt: "Low-top sneaker in kente with a white sole", caption: "Sneaker" },
    ],
    steps: [
      ["Add your print", "Upload a photo of kente, Ankara or leather."],
      ["Choose the shoe", "Pick a heel, boot, sandal or sneaker and the sole you want."],
      ["Set the trim", "Choose zips, buckles or laces, then save the one you like."],
    ],
  },
  bags: {
    eyebrow: "Bag studio",
    title: "The bag you have in mind.",
    intro: "Choose a bag shape and the handles. See your print as a tote and a clutch.",
    fabric: {
      src: adire,
      alt: "Indigo adire fabric with white tie-dye circles",
      caption: "Your adire",
    },
    designs: [
      { src: tote, alt: "Adire tote with tan leather handles", caption: "Structured tote" },
      { src: clutch, alt: "Adire envelope clutch with a gold clasp", caption: "Envelope clutch" },
    ],
    steps: [
      ["Show us the cloth", "Upload adire, Ankara or leather in clear light."],
      ["Pick the bag shape", "Choose a tote, clutch, crossbody or shoulder bag."],
      [
        "Choose handles and clasp",
        "Pick straps and gold or silver hardware, then save the one you like.",
      ],
    ],
  },
};

const collections = [
  {
    name: "Wedding guest",
    src: weddingLook,
    alt: "Saved kente wedding guest outfit",
    note: "Ask for a longer slit and puff sleeves.",
    fav: true,
  },
  {
    name: "Church Sunday",
    src: churchHeel,
    alt: "Saved wax print heel",
    note: "Block heel, not too high.",
    fav: false,
  },
  {
    name: "Office",
    src: officeBag,
    alt: "Saved wax print handbag",
    note: "Line the inside in plain black.",
    fav: true,
  },
];

function Steps({ heading, steps }: { heading: string; steps: Step[] }) {
  return (
    <section className="preview-steps">
      <h2>{heading}</h2>
      <ol>
        {steps.map(([title, text], i) => (
          <li key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function WardrobePreview() {
  return (
    <main className="atelier preview-page wardrobe-preview">
      <div className="preview-heading">
        <p className="atelier-eyebrow">Your wardrobe</p>
        <h1>
          Good ideas.
          <br />
          <em>Worth keeping.</em>
        </h1>
        <p>
          Outfits, bags and shoes you want to come back to. Save your designs in the studio and find
          them here.
        </p>
      </div>
      <div className="collection-caption">
        <span>A glimpse of the possibilities</span>
        <span>Illustrative designs</span>
      </div>
      {/* Pattern adapted from 21st.dev responsive masonry: uneven column
          heights suit a wardrobe, where saved pieces are not one shape. */}
      <div className="wardrobe-masonry">
        {collections.map((c, i) => (
          <article key={c.name} className="masonry-card">
            <img
              src={c.src}
              width={384}
              height={480}
              style={{ aspectRatio: i === 1 ? "4 / 3" : "4 / 5" }}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              alt={`Illustrative concept: ${c.name}`}
            />
            <div className="collection-caption">
              <h2>{c.name}</h2>
            </div>
          </article>
        ))}
      </div>
      <p className="preview-disclaimer">
        These are examples, not your saved designs. Sign in to see your own wardrobe.
      </p>
    </main>
  );
}

export function DesignPreview({
  kind = "outfits",
  wardrobe = false,
  cta,
}: {
  kind?: DesignKind;
  wardrobe?: boolean;
  cta?: React.ReactNode;
}) {
  if (wardrobe) return <WardrobePreview />;
  const p = previews[kind];
  return <StudioPreviewContent preview={p} cta={cta} />;
}

function StudioPreviewContent({ preview: p, cta }: { preview: Preview; cta?: React.ReactNode }) {
  // Same expanding-gallery pattern as the homepage studios: the material
  // and each concept are panels, and the chosen one opens up.
  const panels = [
    { src: p.fabric.src, alt: p.fabric.alt, caption: p.fabric.caption, tag: "Your material" },
    ...p.designs.map((d) => ({ ...d, tag: "Concept" })),
  ];
  const [selected, setSelected] = useState(1);
  return (
    <main className="atelier preview-page">
      <nav className="preview-studio-nav" aria-label="Choose a studio">
        {(
          [
            ["/studio", "Outfits"],
            ["/bag-design", "Bags"],
            ["/shoe-design", "Shoes"],
          ] as const
        ).map(([to, label]) => (
          <Link key={to} to={to} activeProps={{ "aria-current": "page" }}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="preview-heading">
        <p className="atelier-eyebrow">{p.eyebrow}</p>
        <h1>{p.title}</h1>
        <p>{p.intro}</p>
        {cta}
      </div>
      <div className="preview-gallery" role="group" aria-label="Example material and concepts">
        {panels.map((panel, index) => (
          <button
            key={panel.caption}
            type="button"
            className="preview-panel"
            data-active={selected === index}
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
          >
            <img
              src={panel.src}
              alt={panel.alt}
              width={640}
              height={800}
              fetchPriority={index === 1 ? "high" : undefined}
              loading={index === 1 ? "eager" : "lazy"}
            />
            <span className="preview-panel-shade" aria-hidden="true" />
            <span className="preview-panel-label">
              <span>{panel.tag}</span>
              <strong>{panel.caption}</strong>
            </span>
          </button>
        ))}
      </div>
      <Steps heading="At your workbench" steps={p.steps} />
    </main>
  );
}
