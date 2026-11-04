import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import fabricPrint from "@/assets/homepage/fabric-print.webp";
import outfitConcept from "@/assets/homepage/outfit-concept.webp";
import bagConcept from "@/assets/homepage/bag-concept.webp";
import shoeConcept from "@/assets/homepage/shoe-concept.webp";
import { SiteHeader } from "@/components/SiteHeader";
import homeCss from "@/styles/home.css?url";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fashley | From fabric to fashion, imagination to reality" },
      {
        name: "description",
        content:
          "Turn your fabric into outfit ideas. Create bag and shoe concepts, save your favourites, and prepare your next conversation with a tailor.",
      },
      { property: "og:title", content: "Fashley | From fabric to fashion, imagination to reality" },
      {
        property: "og:description",
        content: "A little imagination. A fabric you love. See what you could make with Fashley.",
      },
      { property: "og:image", content: "https://fashley.app/fashley-share.jpg" },
      { name: "twitter:image", content: "https://fashley.app/fashley-share.jpg" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: "https://fashley.app" },
      { rel: "stylesheet", href: homeCss },
    ],
  }),
  component: Home,
});

const studios = [
  {
    name: "Outfits",
    title: "Your fabric, your next creation.",
    description:
      "With Fashley, you get to explore the possibilities before bringing your favourite design to life.",
    image: outfitConcept,
    alt: "Illustrative wrap dress in a blue, cream and yellow fabric print",
    route: "/studio",
    cta: "Design an outfit",
    material: "Your fabric, reimagined",
    detail: "Wrap dress / printed fabric",
  },
  {
    name: "Bags",
    title: "Make it your everyday.",
    description:
      "A statement bag or an everyday companion. Start with a photo of your material, then choose a shape, style and hardware.",
    image: bagConcept,
    alt: "Illustrative structured cognac leather handbag with gold hardware",
    route: "/bag-design",
    cta: "Design a bag",
    material: "The details make it yours",
    detail: "Structured handbag / leather",
  },
  {
    name: "Shoes",
    title: "A different point of view.",
    description:
      "Give your next pair a direction of its own. Bring a material photo and try shoe styles before deciding what you want made.",
    image: shoeConcept,
    alt: "Illustrative suede shoe design",
    route: "/shoe-design",
    cta: "Design a shoe",
    material: "From material to possibility",
    detail: "Shoe concept / suede",
  },
] as const;

/* Pattern adapted from 21st.dev "Centered Hero with Image Fan": a centred
   headline above a fanned stack of real product photos. Cards link to the
   studio each photo belongs to, so the decoration is also navigation. */
const fanCards = [
  {
    label: "Start with your fabric",
    image: fabricPrint,
    alt: "Blue and yellow fabric print",
    route: "/studio",
    tilt: "-9deg",
    lift: "18px",
  },
  {
    label: "Design an outfit",
    image: outfitConcept,
    alt: "Illustrative wrap dress in a blue, cream and yellow fabric print",
    route: "/studio",
    tilt: "-3deg",
    lift: "0px",
  },
  {
    label: "Design a bag",
    image: bagConcept,
    alt: "Illustrative structured cognac leather handbag with gold hardware",
    route: "/bag-design",
    tilt: "3deg",
    lift: "0px",
  },
  {
    label: "Design a shoe",
    image: shoeConcept,
    alt: "Illustrative suede shoe design",
    route: "/shoe-design",
    tilt: "9deg",
    lift: "18px",
  },
] as const;

const marqueeItems = [
  "Upload your fabric",
  "Design an outfit",
  "Try a bag shape",
  "Imagine the shoes",
  "Save it to your wardrobe",
  "Brief your tailor",
] as const;

const steps = [
  {
    title: "Start with what you love.",
    text: "Upload a clear photo of your fabric or material. Let the print, colour and texture lead the way.",
  },
  {
    title: "Give it a direction.",
    text: "Choose an outfit, bag or shoe studio. Pick a category, style and occasion, and add any details you have in mind.",
  },
  {
    title: "See the possibilities.",
    text: "Generate design previews, compare the results, and try a different direction when you want to.",
  },
  {
    title: "Keep the one that feels right.",
    text: "Save your favourites to your wardrobe or download a preview. Your next idea can start where this one leaves off.",
  },
] as const;

const faqs = [
  {
    question: "What do I need to start?",
    answer:
      "Sign in and upload a clear photo of your fabric or material. Choose the outfit, bag or shoe studio, set your preferences, and select how many previews you want to generate.",
  },
  {
    question: "Are these finished products I can buy?",
    answer:
      "No. Fashley generates visual concepts, not physical products or sewing patterns. The examples on this page are illustrative. A maker needs to confirm construction, materials and feasibility before making your design.",
  },
  {
    question: "Can I design an outfit, bag and shoes together?",
    answer:
      "Each studio creates one type of item at a time. Use the outfit studio for clothing, the bag studio for bags, and the shoe studio for shoes. You can save the separate results to your wardrobe.",
  },
  {
    question: "Do I need my measurements to design?",
    answer:
      "No. Start with the visual idea. If you want an outfit made, you can prepare measurements and a brief for tailor review afterward. Your tailor still needs to check your measurements, fabric and intended fit.",
  },
  {
    question: "Can I keep my designs and come back later?",
    answer:
      "Yes. Save a generated design to your wardrobe while signed in, or download the preview. Your saved designs keep the preferences used to create them.",
  },
  {
    question: "How close will the preview be to the real thing?",
    answer:
      "AI-generated previews are a starting point for discussion. Print placement, texture, colour and construction may differ from the real material. Review the concept with your tailor or maker before committing fabric.",
  },
] as const;

const HERO_PLAIN = "From fabric to fashion, ";
const HERO_ACCENT = "imagination to reality.";
const HERO_FULL = HERO_PLAIN + HERO_ACCENT;

function Home() {
  const [selected, setSelected] = useState(0);
  const [typedCount, setTypedCount] = useState(HERO_FULL.length);
  const pageRef = useRef<HTMLDivElement>(null);
  const studio = studios[selected]!;

  // Type the hero headline once on load. SSR and reduced-motion keep the
  // full line; the aria-label always exposes the complete text.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setTypedCount(0);
    const id = window.setInterval(() => {
      setTypedCount((count) => {
        if (count + 1 >= HERO_FULL.length) {
          window.clearInterval(id);
          return HERO_FULL.length;
        }
        return count + 1;
      });
    }, 38);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const elements = pageRef.current?.querySelectorAll<HTMLElement>("[data-reveal]");
    if (
      !elements ||
      !window.IntersectionObserver ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    // Only hide off-screen content once an observer exists; SSR stays readable.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove("reveal-pending");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    elements.forEach((element) => {
      if (element.getBoundingClientRect().top > window.innerHeight) {
        element.classList.add("reveal-pending");
        observer.observe(element);
      }
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="fashion-home" ref={pageRef}>
      <a className="home-skip" href="#home-main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="home-main">
        <section className="home-hero home-container" aria-labelledby="hero-heading">
          <h1 id="hero-heading" aria-label={HERO_FULL}>
            <span aria-hidden="true">
              {HERO_FULL.slice(0, Math.min(typedCount, HERO_PLAIN.length))}
              <em>{HERO_FULL.slice(HERO_PLAIN.length, typedCount)}</em>
              <span className="hero-caret" />
            </span>
          </h1>
          <p className="hero-description">
            You saw a fabric and imagined something. Upload a photo of it and see what it could
            become: an outfit, a bag, a pair of shoes.
          </p>
          <div className="hero-actions">
            <Link className="home-button" to="/studio">
              Design with your fabric <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <a className="home-text-link" href="#how-it-works">
              See how it works <ArrowDown size={15} aria-hidden="true" />
            </a>
          </div>
          <div className="hero-fan" aria-label="What you can design">
            {fanCards.map((card, index) => (
              <Link
                key={card.label}
                className="fan-card"
                to={card.route}
                style={
                  {
                    "--fan-tilt": card.tilt,
                    "--fan-lift": card.lift,
                    zIndex: index + 1,
                  } as CSSProperties
                }
              >
                <img
                  src={card.image}
                  alt={card.alt}
                  width={1600}
                  height={1600}
                  fetchPriority={index === 1 ? "high" : undefined}
                />
                <span>{card.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Pattern adapted from 21st.dev marquee blocks: a moving strip names
            the real actions in the product, in the order a user takes them. */}
        <div className="home-marquee" aria-hidden="true">
          <div className="marquee-track">
            {[...marqueeItems, ...marqueeItems].map((item, index) => (
              <span key={index}>
                {item} <i>*</i>
              </span>
            ))}
          </div>
        </div>

        <section
          id="studios"
          className="home-studios home-container"
          aria-labelledby="studios-heading"
        >
          <div className="home-section-heading" data-reveal>
            <div>
              <h2 id="studios-heading">
                One fabric.
                <br />
                <em>Endless possibilities.</em>
              </h2>
              <p>
                Your imagination sets the direction. Fashley brings the possibilities to life.
              </p>
            </div>
          </div>
          {/* Pattern adapted from 21st.dev animated/expanding galleries: the
              selected photo opens up, the others stay visible as choices. */}
          <div
            className="studio-gallery"
            role="group"
            aria-label="Preview a design studio"
            data-reveal
          >
            {studios.map((item, index) => (
              <button
                key={item.name}
                type="button"
                className="gallery-panel"
                data-active={selected === index}
                aria-pressed={selected === index}
                aria-controls="studio-preview"
                onClick={() => setSelected(index)}
              >
                <img src={item.image} alt={item.alt} width={1600} height={1600} loading="lazy" />
                <span className="gallery-panel-shade" aria-hidden="true" />
                <span className="gallery-panel-label">
                  <span className="gallery-panel-name">{item.name}</span>
                  <span className="gallery-panel-detail">{item.detail}</span>
                </span>
              </button>
            ))}
          </div>
          <div
            id="studio-preview"
            className="studio-description"
            aria-live="polite"
            aria-atomic="true"
            data-reveal
          >
            <div key={studio.name} className="studio-description-inner">
              <div>
                <h3>{studio.title}</h3>
                <p>{studio.description}</p>
              </div>
              <Link className="home-button" to={studio.route}>
                {studio.cta} <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>
            <p className="studio-footnote">
              Each item has its own studio. Every preview starts with your material.
            </p>
          </div>
        </section>

        <section id="how-it-works" className="home-process" aria-labelledby="process-heading">
          <div className="home-container process-grid">
            <div className="process-intro" data-reveal>
              <h2 id="process-heading">
                Every great design
                <br />
                <em>starts somewhere.</em>
              </h2>
              <p>No sketchbook needed. Just a material you love and an idea you want to see.</p>
              <figure className="process-fabric">
                <img
                  src={fabricPrint}
                  alt="Close-up of the texture and pattern of the example fabric"
                  width={1600}
                  height={1600}
                  loading="lazy"
                />
                <figcaption>It starts here. With your material.</figcaption>
              </figure>
            </div>
            <ol className="process-steps">
              {steps.map((step, index) => (
                <li key={step.title} data-reveal>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="next-step" className="home-next home-container" aria-labelledby="next-heading">
          <div className="next-heading" data-reveal>
            <h2 id="next-heading">
              Your ideas deserve
              <br />
              <em>more than a moment.</em>
            </h2>
          </div>
          <div className="next-grid">
            <article className="next-save" data-reveal>
              <h3>
                A wardrobe of
                <br />
                possibilities.
              </h3>
              <p>
                Keep the designs that catch your eye. Save different directions, revisit a
                favourite, or download a preview to take the conversation further.
              </p>
              <Link className="home-text-link" to="/wardrobe">
                Visit your wardrobe <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <div className="saved-materials" aria-hidden="true">
                <img src={shoeConcept} alt="" width={1600} height={1600} loading="lazy" />
                <img src={bagConcept} alt="" width={1600} height={1600} loading="lazy" />
              </div>
            </article>
            <article className="next-tailor" data-reveal>
              <h3>
                Bring your tailor
                <br />
                into the picture.
              </h3>
              <p>
                When you’re ready to have an outfit made, prepare a design brief and measurements
                for tailor review. A clearer starting point for the person bringing it to life.
              </p>
              <Link className="home-text-link" to="/tailor">
                Prepare a tailor brief <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <div className="tailor-note">
                <span>Before the first stitch</span>
                <p>
                  A preview is inspiration, not a sewing pattern. Your tailor confirms fabric
                  suitability, construction and fit with you.
                </p>
              </div>
            </article>
          </div>
        </section>

        <section className="home-questions home-container" aria-labelledby="questions-heading">
          <div data-reveal>
            <h2 id="questions-heading">
              Before you
              <br />
              <em>begin.</em>
            </h2>
            <p>
              Still have a question?
              <br />
              <Link className="home-text-link" to="/contact">
                Talk to us
              </Link>
            </p>
          </div>
          <div className="home-faq-list" data-reveal>
            {faqs.map((faq) => (
              <details key={faq.question}>
                <summary>
                  {faq.question}
                  <span className="faq-plus" aria-hidden="true" />
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="home-finale" aria-labelledby="finale-heading">
          <div className="home-container" data-reveal>
            <h2 id="finale-heading">
              Your next creation
              <br />
              starts with <em>an idea.</em>
            </h2>
            <Link className="home-button" to="/studio">
              Open the design studio <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <p>Bring your fabric. We’ll start there.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
