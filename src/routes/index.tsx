import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Camera, ShoppingBag, Bookmark, ArrowUpRight } from "lucide-react";
import hero from "@/assets/hero.jpg";
import shoe from "@/assets/shoe-design.jpg";
import bag from "@/assets/bag-design.jpg";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { PinterestInspiration } from "@/components/PinterestInspiration";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fashley | Turn your fabric into fashion with AI" },
      { name: "description", content: "See outfit ideas from a photo of your Ankara, kente, lace or adire. Design shoes and bags in the same print. Save a favourite to show your tailor." },
      { property: "og:title", content: "Fashley | Turn your fabric into fashion with AI" },
      { property: "og:description", content: "See outfit ideas from a photo of your Ankara, kente, lace or adire. Design shoes and bags in the same print. Save a favourite to show your tailor." },
      { property: "og:image", content: "https://fashley.lovable.app/fashley-share.jpg" },
      { name: "twitter:image", content: "https://fashley.lovable.app/fashley-share.jpg" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{rel: "canonical", href: "https://fashley.lovable.app"}],
  }),
  component: Index,
});

const steps = [
  { icon: Camera, title: "Snap your fabric", text: "Take a photo of your Ankara, kente, lace or adire." },
  { icon: Sparkles, title: "Choose your designs", text: "Choose a cut and occasion. See two to four outfit ideas." },
  { icon: ShoppingBag, title: "Match your accessories", text: "See shoe and handbag ideas that suit your outfit." },
  { icon: Bookmark, title: "Save your favourites", text: "Keep designs in your wardrobe to show your tailor." },
];

function Index() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Fabric to fashion</p>
            <h1 className="mt-4 text-5xl leading-[1.05] md:text-7xl">
              Picture your fabric <em className="italic">as</em> an outfit.
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              Start with a photo of your fabric. Fashley uses its colours and pattern to draw outfit ideas.
              See shoes and handbags in the same print, with the shape and hardware you choose.
              Save the look you like and show your tailor.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full px-8">
                <Link to="/studio">
                  <Sparkles className="mr-2 h-4 w-4" /> Start a design
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-8">
                <Link to="/wardrobe">My wardrobe</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-blush" />
            <img src={hero} alt="Model wearing a dress made from African wax print fabric" width={1024} height={1280} className="aspect-[4/5] w-full rounded-2xl object-cover" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-4xl">Beyond the outfit</h2>
            <p className="text-muted-foreground">Shoes and bags in your print.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            <article>
              <Link to="/shoe-design" aria-label="Open shoe design" className="block overflow-hidden rounded-lg">
                <img src={shoe} alt="Croc-embossed leather derby shoe with gold eyelets" width={1024} height={1024} loading="lazy" className="aspect-square w-full object-cover transition-transform duration-300 motion-safe:hover:scale-105" />
              </Link>
              <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div><h3 className="text-3xl">Shoe design</h3><p className="mt-1 text-sm text-muted-foreground">Choose sneakers, boots or heels.</p></div>
                <Button asChild variant="outline"><Link to="/shoe-design">Design shoes <ArrowUpRight /></Link></Button>
              </div>
              <PinterestInspiration kind="shoes" />
            </article>
            <article>
              <Link to="/bag-design" aria-label="Open bag design" className="block overflow-hidden rounded-lg">
                <img src={bag} alt="Forest-green croc-embossed handbag with gold hardware" width={1024} height={1024} loading="lazy" className="aspect-square w-full object-cover transition-transform duration-300 motion-safe:hover:scale-105" />
              </Link>
              <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div><h3 className="text-3xl">Bag design</h3><p className="mt-1 text-sm text-muted-foreground">Choose a tote, clutch or handbag.</p></div>
                <Button asChild variant="outline"><Link to="/bag-design">Design bags <ArrowUpRight /></Link></Button>
              </div>
              <PinterestInspiration kind="bags" />
            </article>
          </div>
        </section>

        <section className="bg-sand/60">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.title}>
                <span className="font-display text-4xl text-muted-foreground">0{i + 1}</span>
                <s.icon className="mt-3 h-5 w-5" />
                <h3 className="mt-3 text-2xl">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="mx-auto max-w-6xl px-5 py-10 text-xs text-muted-foreground">
          These images are design ideas, not sewing patterns. They do not show how an outfit will fit or how much fabric you need.
        </p>
      </main>
    </div>
  );
}
