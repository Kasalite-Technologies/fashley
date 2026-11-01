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
        content:
          "Upload a photo of your fabric and preview outfit, bag and shoe ideas in your own print. When you are ready, a tailor checks your measurements and the brief before anything is made.",
      },
      { property: "og:title", content: "Fashley | See what your fabric could become" },
      {
        property: "og:description",
        content:
          "Upload a photo of your fabric and preview outfit, bag and shoe ideas in your own print. When you are ready, a tailor checks your measurements and the brief before anything is made.",
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
  ["Your fabric", "Start with a photo of the fabric you already have."],
  ["Design idea", "See AI outfit concepts in your print and pick a direction."],
  ["Your measurements", "Add the measurements you know. Your tailor checks them with you."],
  ["Tailor brief", "Send your tailor a brief with the design and measurements together."],
  ["Tailor approves", "Your tailor reviews and approves the brief before any sewing starts."],
] as const;

const faqs = [
  {
    q: "Is the preview the final garment?",
    a: "No. A preview shows print and shape ideas only. Your tailor confirms what can be made from your fabric before anything is cut or sewn.",
  },
  {
    q: "Who checks my measurements?",
    a: "You enter your measurements, and your tailor verifies them before making the outfit. Correct any measurement with your tailor if it does not look right.",
  },
  {
    q: "Is fit guaranteed?",
    a: "No. Measurements alone cannot guarantee fit. Fit depends on the fabric, the style, and how the garment is made, which is why your tailor verifies your measurements and the brief first.",
  },
  {
    q: "Who sees my fabric photos?",
    a: "Your fabric photos are private to your account. A tailor sees only the brief you choose to send through its link.",
  },
  {
    q: "What happens if my tailor requests changes?",
    a: "You see the tailor's note, update the design or measurements, and a new brief version is created. Your tailor reviews the new version before anything is made.",
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
                Upload a photo of your fabric and preview outfit, bag and shoe ideas in your own
                print. When you are ready, a tailor checks your measurements and the brief before
                anything is made.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/tailor">
                    Upload your fabric <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/studio">Open the design studios</Link>
                </Button>
              </div>
              <p className="mt-4 max-w-md text-sm text-muted-foreground">
                Uploading your fabric starts an outfit project with a tailor. The design studios are
                for trying print ideas, with no tailor involved.
              </p>
            </div>

            <figure>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <img
                    src={fabricPrint}
                    alt="Example fabric print used as the source for the previews on this page"
                    width={1600}
                    height={1600}
                    className="aspect-square w-full rounded-lg border border-border object-cover"
                  />
                  <p className="mt-2 font-mono text-xs text-muted-foreground">Your fabric</p>
                </div>
                <div>
                  <img
                    src={outfitConcept}
                    alt="Example AI preview of an outfit made in the same fabric print"
                    width={1120}
                    height={2240}
                    className="aspect-square w-full rounded-lg border border-border object-cover"
                  />
                  <p className="mt-2 font-mono text-xs text-muted-foreground">Outfit preview</p>
                </div>
              </div>
              <figcaption className="mt-3 text-xs text-muted-foreground">
                Example images. The fabric on the left is the source for the outfit preview on the
                right. Previews show print and shape ideas, not the finished garment.
              </figcaption>
            </figure>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <article className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-sans text-xl font-semibold tracking-tight">I have fabric</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Start an outfit project, add your measurements, and send your tailor a brief to
                review before anything is made.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/tailor">
                  Make an outfit with a tailor <ArrowRight />
                </Link>
              </Button>
            </article>
            <article className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-sans text-xl font-semibold tracking-tight">I design</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Try a print across outfits, shoes, and bags in the design studios, and save each
                version with the choices that produced it.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/studio">
                  Experiment in the studios <ArrowRight />
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
            <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              AI concepts are previews only, not sewing patterns or a promise of fit. Measurements
              are entered by you and verified by your tailor.
            </p>
          </div>
        </section>

        {/* 3. Fabric to concept proof */}
        <section className="mx-auto max-w-6xl px-5 py-14">
          <SectionHeading>One fabric, three previews</SectionHeading>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            The same print, shown as an outfit, a bag, and a shoe. Each image below is an AI preview
            example. Previews show print and shape ideas, not the finished garment.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <figure>
              <img
                src={fabricPrint}
                alt="Example fabric print, the source for the three previews next to it"
                width={1600}
                height={1600}
                loading="lazy"
                className="aspect-square w-full rounded-lg border border-border object-cover"
              />
              <figcaption className="mt-2 text-sm text-muted-foreground">
                Source fabric. Example photo.
              </figcaption>
            </figure>
            <figure>
              <img
                src={outfitConcept}
                alt="Example AI preview of an outfit in the source fabric print"
                width={1120}
                height={2240}
                loading="lazy"
                className="aspect-square w-full rounded-lg border border-border object-cover"
              />
              <figcaption className="mt-2 text-sm text-muted-foreground">
                Outfit. AI preview example.
              </figcaption>
            </figure>
            <figure>
              <img
                src={bagConcept}
                alt="Example AI preview of a bag in the source fabric print"
                width={1920}
                height={1280}
                loading="lazy"
                className="aspect-square w-full rounded-lg border border-border object-cover"
              />
              <figcaption className="mt-2 text-sm text-muted-foreground">
                Bag. AI preview example, studio concept only.
              </figcaption>
            </figure>
            <figure>
              <img
                src={shoeConcept}
                alt="Example AI preview of a shoe in the source fabric print"
                width={1920}
                height={1280}
                loading="lazy"
                className="aspect-square w-full rounded-lg border border-border object-cover"
              />
              <figcaption className="mt-2 text-sm text-muted-foreground">
                Shoe. AI preview example, studio concept only.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* 4. For designers */}
        <section className="border-y border-border bg-muted/50">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <SectionHeading>For designers</SectionHeading>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
              Test a print across garments and accessories before you commit to a direction. Each
              saved version keeps the choices that produced it, so you can compare versions and
              return to one later. These are design studios for outfits, shoes, and bags. Only
              outfit projects go to a tailor.
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

        {/* 5. Measurements and the tailor check */}
        <section id="tailor-check" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-14">
          <SectionHeading>Measurements and the tailor check</SectionHeading>
          <div className="mt-4 max-w-2xl space-y-4 leading-relaxed text-muted-foreground">
            <p>
              You type your own measurements, in centimetres or inches, and they are saved with your
              outfit project.
            </p>
            <p>
              Your tailor verifies your measurements before making anything. If a measurement looks
              wrong, you correct it together and the brief is updated.
            </p>
            <p>
              Fashley does not guarantee fit from measurements alone. Fit also depends on the
              fabric, the style, and how the garment is made.
            </p>
          </div>
        </section>

        {/* 6. The versioned brief */}
        <section id="brief" className="border-y border-border bg-muted/50">
          <div className="mx-auto max-w-6xl scroll-mt-24 px-5 py-14">
            <SectionHeading>A brief the tailor can say yes or no to</SectionHeading>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
              An outfit project becomes a brief: the design and your measurements in one place. Your
              tailor reviews each version and can approve the design, request changes, or accept the
              job. If changes are requested, you update the project and a new version is sent. The
              tailor flow covers outfits only.
            </p>

            <article
              aria-label="Example tailor brief"
              className="mt-8 max-w-2xl rounded-lg border border-border bg-card p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-sans text-lg font-semibold tracking-tight">Tailor brief</h3>
                <span className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground">
                  Example
                </span>
              </div>

              <div className="mt-6 space-y-6">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">Brief v1</p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex gap-2">
                      <dt className="font-medium">Design:</dt>
                      <dd className="text-muted-foreground">
                        Outfit preview in your fabric print, with the style choices you picked.
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-medium">Measurements:</dt>
                      <dd className="text-muted-foreground">
                        The measurements you entered, saved with this version.
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                    Example tailor note: &ldquo;Please confirm the sleeve length before I
                    start.&rdquo; This note is an example, not a real customer message.
                  </p>
                </div>

                <div className="border-t border-border pt-6">
                  <p className="font-mono text-xs text-muted-foreground">Brief v2</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Updated after the tailor note, with the corrected measurement. The tailor
                    reviews this version before anything is made.
                  </p>
                </div>
              </div>

              <div className="mt-6 border-t border-border pt-6">
                <p className="text-sm font-medium">What the tailor can do with a brief</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {["Approve design", "Request changes", "Accept the job"].map((state) => (
                    <li
                      key={state}
                      className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium"
                    >
                      {state}
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <Button asChild className="mt-8">
              <Link to="/tailor">
                Start an outfit project <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>

        {/* 7. Studios */}
        <section className="mx-auto max-w-6xl px-5 py-14">
          <SectionHeading>The studios</SectionHeading>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Studio results are design concepts. Shoes and bags exist only as studio concepts, with
            no tailor brief or ordering.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <article className="rounded-lg border border-border bg-card p-6">
              <h3 className="font-sans text-xl font-semibold tracking-tight">Outfit studio</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                See outfit ideas in your fabric print and pick a direction.
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
                Try your print on shoe shapes as a design concept.
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
                Try your print on bag shapes as a design concept.
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

        {/* 8. Honesty FAQ */}
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
          <SectionHeading>Start with the fabric you already have</SectionHeading>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Upload a photo of your fabric to start an outfit project. Your tailor checks your
            measurements and the brief before anything is made.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/tailor">
                Upload your fabric <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#tailor-check">See how the tailor check works</a>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
