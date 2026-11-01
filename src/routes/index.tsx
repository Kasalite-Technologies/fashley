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
          "Upload a photo of your fabric, choose an outfit, a bag or a shoe, and preview up to four styles in your own print. Keep the design for yourself, or share it with a tailor if you want it made.",
      },
      { property: "og:title", content: "Fashley | See what your fabric could become" },
      {
        property: "og:description",
        content:
          "Upload a photo of your fabric, choose an outfit, a bag or a shoe, and preview up to four styles in your own print. Keep the design for yourself, or share it with a tailor if you want it made.",
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
  ["Pick what to make", "Choose an outfit, a bag or a shoe. Each one is designed separately."],
  ["Your fabric", "Start with a photo of the fabric you already have."],
  ["Up to 4 previews", "See up to four style previews in your print and compare them."],
  ["Pick your favourite", "Save the preview you like and keep designing if you want more."],
  ["Only if you want it made", "Add measurements and share the design with a tailor. This part is your choice."],
] as const;

const faqs = [
  {
    q: "Is the preview the final garment?",
    a: "No. A preview shows print and shape ideas only. If you decide to have the outfit made, a tailor confirms what can be made from your fabric before anything is cut or sewn.",
  },
  {
    q: "Do outfits, bags and shoes come together?",
    a: "No. You pick one design type at a time: an outfit, a bag or a shoe. Each design is created in its own studio or project, with its own fabric photo and previews.",
  },
  {
    q: "Do I have to send my design to a tailor?",
    a: "No. Generating and saving a design does not send it anywhere. Sharing with a tailor is a separate step you choose only if you want the outfit made.",
  },
  {
    q: "Is fit guaranteed?",
    a: "No. Measurements alone cannot guarantee fit. Fit depends on the fabric, the style, and how the garment is made. If you share your design with a tailor, they verify your measurements with you first.",
  },
  {
    q: "Who sees my fabric photos?",
    a: "Your fabric photos are private to your account. A tailor sees only the design you choose to share through its link.",
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
                Upload a photo of your fabric, pick an outfit, a bag or a shoe, and preview up to
                four styles in your own print. Keep the design for yourself, or share it with a
                tailor if you want it made.
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
                Nothing is sent to a tailor unless you choose to share it. Outfits, bags and shoes
                are each designed separately.
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
                Start an outfit project and preview up to four styles in your fabric. Add
                measurements and share it with a tailor only if you want it made.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/tailor">
                  Start an outfit project <ArrowRight />
                </Link>
              </Button>
            </article>
            <article className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-sans text-xl font-semibold tracking-tight">I design</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Work on one design type at a time in its own studio: outfits, shoes or bags, each
                with its own fabric photo, previews and saved versions.
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
              AI previews are design ideas only, not sewing patterns or a promise of fit.
              Measurements are entered by you, and only matter if you choose to have an outfit
              made.
            </p>
          </div>
        </section>

        {/* 3. Separate design types */}
        <section className="mx-auto max-w-6xl px-5 py-14">
          <SectionHeading>Pick one: outfit, bag or shoe</SectionHeading>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Each design type is made on its own. You upload your fabric for the one you picked,
            and Fashley generates up to four style previews for that item only. An outfit design
            does not also generate a bag or shoes.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <article className="rounded-lg border border-border bg-card p-6">
              <img
                src={outfitConcept}
                alt="Example AI preview of an outfit made from an example fabric print"
                width={1120}
                height={2240}
                loading="lazy"
                className="aspect-square w-full rounded-md border border-border object-cover"
              />
              <h3 className="mt-4 font-sans text-xl font-semibold tracking-tight">Outfit</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Upload your fabric and preview up to four outfit styles in your print, then pick
                your favourite. Example AI preview.
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
                alt="Example AI preview of a bag made from an example fabric print"
                width={1920}
                height={1280}
                loading="lazy"
                className="aspect-square w-full rounded-md border border-border object-cover"
              />
              <h3 className="mt-4 font-sans text-xl font-semibold tracking-tight">Bag</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A separate studio for bags. Your bag design starts with its own fabric photo and
                its own previews. Example AI preview.
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
                alt="Example AI preview of shoes made from an example fabric print"
                width={1920}
                height={1280}
                loading="lazy"
                className="aspect-square w-full rounded-md border border-border object-cover"
              />
              <h3 className="mt-4 font-sans text-xl font-semibold tracking-tight">Shoe</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A separate studio for shoes. Your shoe design starts with its own fabric photo and
                its own previews. Example AI preview.
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
              Every design starts from a fabric photo like this example. The examples on this page
              use one print family to show the idea; your previews come from your own fabric.
              Previews show print and shape ideas, not the finished item.
            </figcaption>
          </figure>
        </section>

        {/* 4. For designers */}
        <section className="border-y border-border bg-muted/50">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <SectionHeading>For designers</SectionHeading>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
              Explore one design type at a time before you commit to a direction. Each studio
              keeps its own fabric, previews and saved versions, so you can compare versions and
              return to one later. Outfits, shoes and bags are designed separately, never bundled
              into one generation.
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

        {/* 5. Measurements, only if you want it made */}
        <section id="measurements" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-14">
          <SectionHeading>Measurements, only if you want it made</SectionHeading>
          <div className="mt-4 max-w-2xl space-y-4 leading-relaxed text-muted-foreground">
            <p>
              Designing does not need measurements. If you decide to have an outfit made, you can
              type your own measurements, in centimetres or inches, and save them with your outfit
              project.
            </p>
            <p>
              If you share the design with a tailor, they verify your measurements with you before
              making anything. If a measurement looks wrong, you correct it together.
            </p>
            <p>
              Fashley does not guarantee fit from measurements alone. Fit also depends on the
              fabric, the style, and how the garment is made.
            </p>
          </div>
        </section>

        {/* 6. Sharing is your choice */}
        <section className="border-y border-border bg-muted/50">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <SectionHeading>Your design, your choice</SectionHeading>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
              When you generate a design, it is yours. Nothing is sent to a tailor automatically,
              and you do not need a tailor to design, preview or save your ideas.
            </p>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <article className="rounded-lg border border-border bg-card p-6">
                <h3 className="font-sans text-xl font-semibold tracking-tight">
                  Keep it for yourself
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Save your favourite preview, come back to it later, or generate a new set of
                  styles from the same fabric. That is a complete design on its own.
                </p>
              </article>
              <article className="rounded-lg border border-border bg-card p-6">
                <h3 className="font-sans text-xl font-semibold tracking-tight">
                  Or share it with a tailor
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  If you want the outfit made, you can choose to share the design and your
                  measurements with your own tailor through a private link. Sharing is a separate
                  step, and it only happens when you start it. This applies to outfits only; bag
                  and shoe designs stay in their studios.
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
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            One studio per design type. Each studio starts with its own fabric photo and generates
            its own set of up to four previews. Studio results are design concepts, with no
            ordering.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <article className="rounded-lg border border-border bg-card p-6">
              <h3 className="font-sans text-xl font-semibold tracking-tight">Outfit studio</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                See up to four outfit ideas in your fabric print and pick a direction.
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
                Try your print on shoe shapes only, as its own design concept.
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
                Try your print on bag shapes only, as its own design concept.
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
            Upload a photo of your fabric, pick an outfit, a bag or a shoe, and see up to four
            styles in your print. What you do with the design afterwards is up to you.
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
