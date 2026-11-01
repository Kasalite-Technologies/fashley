import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import fabricPrint from "@/assets/homepage/fabric-print.webp";
import outfitConcept from "@/assets/homepage/outfit-concept.webp";
import bagConcept from "@/assets/homepage/bag-concept.webp";
import shoeConcept from "@/assets/homepage/shoe-concept.webp";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { PinterestInspiration } from "@/components/PinterestInspiration";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fashley | See what your fabric could become" },
      {
        name: "description",
        content: "Upload your fabric. See four outfit, bag, or shoe designs in your print.",
      },
      { property: "og:title", content: "Fashley | See what your fabric could become" },
      {
        property: "og:description",
        content: "Upload your fabric. See four outfit, bag, or shoe designs in your print.",
      },
      { property: "og:image", content: "https://fashley.lovable.app/fashley-share.jpg" },
      { name: "twitter:image", content: "https://fashley.lovable.app/fashley-share.jpg" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://fashley.lovable.app" }],
  }),
  component: Index,
});

const steps = [
  ["Pick one", "An outfit, a bag, or a shoe."],
  ["Add your fabric", "One photo is enough."],
  ["See four previews", "Four styles, your print."],
  ["Pick a favourite", "Save it, or run it again."],
  ["Want it made?", "Add measurements and send it to your tailor."],
] as const;

const faqs = [
  {
    q: "Is the preview the final garment?",
    a: "No. Previews show print and shape. A tailor confirms the rest before anything is cut.",
  },
  {
    q: "Do outfits, bags and shoes come together?",
    a: "No. Pick one at a time. Each design is made separately.",
  },
  {
    q: "Do I have to send my design to a tailor?",
    a: "No. Only if you want the outfit made.",
  },
  {
    q: "Is fit guaranteed?",
    a: "No. Fabric, style, and making all change fit. Your tailor checks your measurements with you.",
  },
  {
    q: "Who sees my fabric photos?",
    a: "Only you, until you share a design link.",
  },
] as const;

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="font-sans text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
      {children}
    </h2>
  );
}

function Index() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <SiteHeader />
      <main>
        {/* 1. Hero */}
        <section className="mx-auto max-w-6xl px-5 py-12 md:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h1 className="font-sans text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
                See what your fabric could become
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
                Upload your fabric, pick an outfit, bag, or shoe, and see four designs in your
                print.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/tailor">
                    Upload your fabric <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/studio">Open the studios</Link>
                </Button>
              </div>
            </div>

            <figure>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <img
                    src={fabricPrint}
                    alt="Example fabric print"
                    width={1600}
                    height={1600}
                    className="aspect-square w-full rounded-lg border border-border object-cover"
                  />
                  <p className="mt-2 font-mono text-xs text-muted-foreground">Your fabric</p>
                </div>
                <div>
                  <img
                    src={outfitConcept}
                    alt="Example outfit preview in the same print"
                    width={1120}
                    height={2240}
                    className="aspect-square w-full rounded-lg border border-border object-cover"
                  />
                  <p className="mt-2 font-mono text-xs text-muted-foreground">Outfit preview</p>
                </div>
              </div>
              <figcaption className="mt-3 text-xs text-muted-foreground">
                Example fabric, example outfit. Yours starts with your fabric.
              </figcaption>
            </figure>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <article className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-sans text-xl font-semibold tracking-tight">I have fabric</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Four outfit previews in your print. Pick the one you like.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/tailor">
                  Start an outfit <ArrowRight />
                </Link>
              </Button>
            </article>
            <article className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-sans text-xl font-semibold tracking-tight">I design</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                One studio per item. Outfits, bags, and shoes, designed separately.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/studio">
                  Open the studios <ArrowRight />
                </Link>
              </Button>
            </article>
          </div>
        </section>

        {/* 2. How it works */}
        <section className="border-y border-border">
          <div className="mx-auto max-w-6xl px-5 py-12">
            <SectionHeading>How it works</SectionHeading>
            <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
              {steps.map(([title, text], i) => (
                <li key={title}>
                  <span className="font-mono text-sm text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 font-sans text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 3. Separate design types */}
        <section className="mx-auto max-w-6xl px-5 py-14">
          <SectionHeading>Outfit, bag, or shoe?</SectionHeading>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Each one is designed on its own.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <article className="rounded-lg border border-border bg-card p-6">
              <img
                src={outfitConcept}
                alt="Example outfit preview in an example print"
                width={1120}
                height={2240}
                loading="lazy"
                className="aspect-square w-full rounded-md border border-border object-cover"
              />
              <h3 className="mt-4 font-sans text-xl font-semibold tracking-tight">Outfit</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Four previews in your print. Example outfit shown.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/tailor">
                  Start an outfit <ArrowRight />
                </Link>
              </Button>
            </article>
            <article className="rounded-lg border border-border bg-card p-6">
              <img
                src={bagConcept}
                alt="Example bag preview in an example print"
                width={1920}
                height={1280}
                loading="lazy"
                className="aspect-square w-full rounded-md border border-border object-cover"
              />
              <h3 className="mt-4 font-sans text-xl font-semibold tracking-tight">Bag</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Its own studio, its own previews. Example bag shown.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/bag-design">
                  Open bag studio <ArrowUpRight />
                </Link>
              </Button>
            </article>
            <article className="rounded-lg border border-border bg-card p-6">
              <img
                src={shoeConcept}
                alt="Example shoe preview in an example print"
                width={1920}
                height={1280}
                loading="lazy"
                className="aspect-square w-full rounded-md border border-border object-cover"
              />
              <h3 className="mt-4 font-sans text-xl font-semibold tracking-tight">Shoe</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Its own studio, its own previews. Example shoes shown.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/shoe-design">
                  Open shoe studio <ArrowUpRight />
                </Link>
              </Button>
            </article>
          </div>
          <figure className="mt-8 flex items-start gap-4">
            <img
              src={fabricPrint}
              alt="Example fabric print"
              width={1600}
              height={1600}
              loading="lazy"
              className="h-20 w-20 rounded-md border border-border object-cover"
            />
            <figcaption className="text-sm leading-relaxed text-muted-foreground">
              Every design starts with a fabric photo. This print is an example.
            </figcaption>
          </figure>
        </section>

        {/* 4. For designers */}
        <section className="border-y border-border bg-muted/50">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <SectionHeading>For designers</SectionHeading>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
              Try a print. Save each version. Compare, then commit.
            </p>
            <ul className="mt-6 flex flex-wrap gap-3">
              <li>
                <Button asChild variant="outline">
                  <Link to="/studio">
                    Outfit studio <ArrowUpRight />
                  </Link>
                </Button>
              </li>
              <li>
                <Button asChild variant="outline">
                  <Link to="/shoe-design">
                    Shoe studio <ArrowUpRight />
                  </Link>
                </Button>
              </li>
              <li>
                <Button asChild variant="outline">
                  <Link to="/bag-design">
                    Bag studio <ArrowUpRight />
                  </Link>
                </Button>
              </li>
            </ul>
          </div>
        </section>

        {/* 5. Measurements */}
        <section id="measurements" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-14">
          <SectionHeading>Measurements, when you need them</SectionHeading>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Design first. If you want the outfit made, add your measurements and your tailor
            checks them with you. Measurements alone never guarantee fit.
          </p>
        </section>

        {/* 6. Keep it or get it made */}
        <section className="border-y border-border bg-muted/50">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <SectionHeading>Keep it, or get it made</SectionHeading>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <article className="rounded-lg border border-border bg-card p-6">
                <h3 className="font-sans text-xl font-semibold tracking-tight">Keep it</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Save your favourite. Come back anytime.
                </p>
              </article>
              <article className="rounded-lg border border-border bg-card p-6">
                <h3 className="font-sans text-xl font-semibold tracking-tight">Get it made</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Send the outfit and your measurements to your tailor.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link to="/tailor">
                    Start an outfit project <ArrowRight />
                  </Link>
                </Button>
              </article>
            </div>
          </div>
        </section>

        {/* 7. Studios */}
        <section className="mx-auto max-w-6xl px-5 py-14">
          <SectionHeading>The studios</SectionHeading>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <article className="rounded-lg border border-border bg-card p-6">
              <h3 className="font-sans text-xl font-semibold tracking-tight">Outfit studio</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Four outfit previews in your print.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/studio">
                  Open outfit studio <ArrowUpRight />
                </Link>
              </Button>
            </article>
            <article className="rounded-lg border border-border bg-card p-6">
              <h3 className="font-sans text-xl font-semibold tracking-tight">Shoe studio</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Your print, on shoes.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/shoe-design">
                  Open shoe studio <ArrowUpRight />
                </Link>
              </Button>
              <PinterestInspiration kind="shoes" />
            </article>
            <article className="rounded-lg border border-border bg-card p-6">
              <h3 className="font-sans text-xl font-semibold tracking-tight">Bag studio</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Your print, on bags.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/bag-design">
                  Open bag studio <ArrowUpRight />
                </Link>
              </Button>
              <PinterestInspiration kind="bags" />
            </article>
          </div>
        </section>

        {/* 8. FAQ */}
        <section className="border-y border-border">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <SectionHeading>Questions, answered plainly</SectionHeading>
            <Accordion type="single" collapsible className="mt-8 max-w-3xl">
              {faqs.map((item) => (
                <AccordionItem key={item.q} value={item.q}>
                  <AccordionTrigger className="font-sans text-base font-medium">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="leading-relaxed text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* 9. Final CTA */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <SectionHeading>Start with your fabric</SectionHeading>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            One photo in. Four designs out.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/tailor">
                Upload your fabric <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#measurements">How measurements work</a>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
