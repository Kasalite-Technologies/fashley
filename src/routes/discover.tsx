import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, TrendingUp, Compass } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import trend0 from "@/assets/trends/0.jpg";
import trend1 from "@/assets/trends/1.jpg";
import trend2 from "@/assets/trends/2.jpg";
import trend3 from "@/assets/trends/3.jpg";
import trend4 from "@/assets/trends/4.jpg";
import trend5 from "@/assets/trends/5.jpg";
import trend6 from "@/assets/trends/6.jpg";
import trend7 from "@/assets/trends/7.jpg";
import trend8 from "@/assets/trends/8.jpg";
import trend9 from "@/assets/trends/9.jpg";
import trend10 from "@/assets/trends/10.jpg";
import trend11 from "@/assets/trends/11.jpg";
import { BackButton } from "@/components/BackButton";


export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover styles | Fashley" },
      { name: "description", content: "Find Ankara gowns, kente wedding looks and kaba and slit styles. Open Pinterest for more ideas to show your tailor." },
      { property: "og:title", content: "Discover styles | Fashley" },
      { property: "og:description", content: "Find Ankara gowns, kente wedding looks and kaba and slit styles. Open Pinterest for more ideas to show your tailor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Discover,
});

const trendImages = [trend0, trend1, trend2, trend3, trend4, trend5, trend6, trend7, trend8, trend9, trend10, trend11];
const trendAlts = [
  "Woman in a red and gold Ankara corset gown with a flared skirt",
  "Ghanaian bride and groom in matching kente at their traditional engagement ceremony, the groom's cloth draped toga style",
  "Woman in a kaba and slit outfit",
  "Man in a northern Ghana fugu smock",
  "Woman in a blue and white adire two piece set with wide leg trousers",
  "Woman in a lilac lace mermaid gown with a matching headtie",
  "Graduate wearing a kente stole",
  "Woman in a multicolour wax print blazer with black trousers",
  "Woman in a loose bubu kaftan",
  "Man in a yellow kente agbada with a matching cap",
  "Woman in a red and black off-shoulder print gown with a matching headwrap",
  "Woman in a sleeveless kente jumpsuit with wide legs",
];
const pin = (q: string) => `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`;

const trending = [
  { name: "Ankara corset gowns", tag: "Evening", q: "ankara corset gown" },
  { name: "Kente wedding looks", tag: "Bridal", q: "kente wedding dress" },
  { name: "Kaba & slit", tag: "Classic", q: "kaba and slit styles Ghana" },
  { name: "Fugu & smock styles", tag: "Northern", q: "fugu smock styles Ghana" },
  { name: "Adire two-piece sets", tag: "Casual", q: "adire two piece set" },
  { name: "Aso-ebi lace styles", tag: "Owambe", q: "aso ebi lace styles 2026" },
  { name: "Kente graduation stoles", tag: "Graduation", q: "kente graduation stole outfit" },
  { name: "Wax print blazers", tag: "Work", q: "african print blazer women" },
  { name: "Bubu kaftans", tag: "Relaxed", q: "bubu kaftan dress" },
  { name: "Men's kente agbada", tag: "Ceremony", q: "kente agbada styles men Ghana" },
  { name: "Red & black funeral wear", tag: "Tradition", q: "Ghanaian funeral attire styles" },
  { name: "Kente jumpsuits", tag: "Modern", q: "kente jumpsuit styles" },
];

const discover = [
  { name: "Puff-sleeve midi dresses", q: "ankara puff sleeve midi dress" },
  { name: "Mermaid skirts", q: "african print mermaid skirt" },
  { name: "Men's agbada", q: "modern agbada styles" },
  { name: "Senator wear", q: "senator native wear men" },
  { name: "Wrap jumpsuits", q: "ankara jumpsuit wrap" },
  { name: "Matching headwraps", q: "gele headwrap styles" },
  { name: "Batakari smocks", q: "batakari smock styles Ghana" },
  { name: "Krobo bead jewellery", q: "krobo beads necklace Ghana" },
  { name: "Lace kaba & slit", q: "lace kaba and slit Ghana" },
  { name: "Men's kente wrapper", q: "kente cloth wrapper men Ghana" },
  { name: "GTP print dresses", q: "GTP fabric dress styles Ghana" },
  { name: "Matching couple prints", q: "Ghanaian couple matching outfit styles" },
  { name: "Kids' prints", q: "ankara styles for kids" },
  { name: "Statement accessories", q: "african print bags shoes" },
];

function Discover() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <BackButton fallback="/" label="Back" className="mb-8" />
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Inspiration</p>

        <h1 className="mt-3 text-5xl">Discover styles</h1>
        <p className="mt-3 max-w-lg text-muted-foreground">
          Find a cut for your Ankara or kente. Browse Ghanaian looks and styles from across Africa.
        </p>

        <section className="mt-12">
          <h2 className="flex items-center gap-2 text-3xl"><TrendingUp className="h-5 w-5" /> Trending now</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trending.map((t, i) => (
              <a
                key={t.q}
                href={pin(t.q)}
                target="_blank"
                rel="noopener noreferrer"
                className="group overflow-hidden rounded-lg border border-border bg-card transition motion-safe:hover:-translate-y-0.5"
              >
                <img src={trendImages[i]} alt={trendAlts[i]} width={384} height={384} loading="lazy" className="aspect-square w-full object-cover" />
                <div className="p-5 pt-2"><span className="text-xs uppercase tracking-widest text-muted-foreground">#{i + 1} · {t.tag}</span>
                <div className="flex items-end justify-between gap-3">
                  <h3 className="min-w-0 text-2xl">{t.name}</h3>
                  <ExternalLink className="h-4 w-4 shrink-0 opacity-60 group-hover:opacity-100" />
                </div></div>
              </a>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="flex items-center gap-2 text-3xl"><Compass className="h-5 w-5" /> Discover more</h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {discover.map((d) => (
              <a
                key={d.q}
                href={pin(d.q)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                {d.name} <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
          <p className="mt-8 text-xs text-muted-foreground">Pinterest links open in a new tab.</p>
        </section>
      </main>
    </div>
  );
}
