import { Link } from '@tanstack/react-router';
import { Heart, NotebookPen, Share2 } from 'lucide-react';
import { Button } from './ui/button';
import type { DesignKind } from '@/lib/design-options';
import waxFabric from '@/assets/previews/0.jpg';
import dress from '@/assets/previews/1.jpg';
import jumpsuit from '@/assets/previews/2.jpg';
import skirt from '@/assets/previews/3.jpg';
import kente from '@/assets/previews/shoe-fabric.jpg';
import boot from '@/assets/previews/shoe-boot.jpg';
import sneaker from '@/assets/previews/shoe-sneaker.jpg';
import adire from '@/assets/previews/bag-fabric.jpg';
import tote from '@/assets/previews/bag-tote.jpg';
import clutch from '@/assets/previews/bag-clutch.jpg';
import weddingLook from '@/assets/previews/wardrobe-wedding.jpg';
import churchHeel from '@/assets/previews/4.jpg';
import officeBag from '@/assets/previews/6.jpg';

type Step = [string, string];
type Preview = {
  eyebrow: string; title: string; intro: string;
  fabric: { src: string; alt: string; caption: string };
  designs: { src: string; alt: string; caption: string }[];
  steps: Step[];
};

const previews: Record<DesignKind, Preview> = {
  outfits: {
    eyebrow: 'Outfit studio',
    title: 'One fabric photo, three outfit ideas',
    intro: 'Take a photo of your wax print. Fashley shows it as a dress, a jumpsuit and a skirt set.',
    fabric: { src: waxFabric, alt: 'Turquoise, yellow and magenta wax print fabric', caption: 'Your wax print' },
    designs: [
      { src: dress, alt: 'Dress in the example wax print', caption: 'Fitted dress' },
      { src: jumpsuit, alt: 'Jumpsuit in the example wax print', caption: 'Jumpsuit' },
      { src: skirt, alt: 'Skirt set in the example wax print', caption: 'Skirt set' },
    ],
    steps: [
      ['Photograph your fabric', 'Lay the cloth flat in good light and take one clear photo.'],
      ['Pick a cut and occasion', 'Choose a style, such as kaba and slit or a short dress.'],
      ['Compare the outfits', 'See two to four outfits and keep the one for your tailor.'],
    ],
  },
  shoes: {
    eyebrow: 'Shoe studio',
    title: 'Put your kente on a pair of shoes',
    intro: 'Choose a shoe type and hardware. See your print on boots and sneakers.',
    fabric: { src: kente, alt: 'Folded gold, green and red kente cloth', caption: 'Your kente' },
    designs: [
      { src: boot, alt: 'Ankle boot in kente with brown leather trim', caption: 'Ankle boot' },
      { src: sneaker, alt: 'Low-top sneaker in kente with a white sole', caption: 'Sneaker' },
    ],
    steps: [
      ['Add your print', 'Upload a photo of kente, Ankara or leather.'],
      ['Choose the shoe', 'Pick a heel, boot, sandal or sneaker and the sole you want.'],
      ['Set the trim', 'Choose zips, buckles or laces, then show the shoemaker.'],
    ],
  },
  bags: {
    eyebrow: 'Bag studio',
    title: 'See your adire as a handbag',
    intro: 'Choose a bag shape and the handles. See your print as a tote and a clutch.',
    fabric: { src: adire, alt: 'Indigo adire fabric with white tie-dye circles', caption: 'Your adire' },
    designs: [
      { src: tote, alt: 'Adire tote with tan leather handles', caption: 'Structured tote' },
      { src: clutch, alt: 'Adire envelope clutch with a gold clasp', caption: 'Envelope clutch' },
    ],
    steps: [
      ['Show us the cloth', 'Upload adire, Ankara or leather in clear light.'],
      ['Pick the bag shape', 'Choose a tote, clutch, crossbody or shoulder bag.'],
      ['Choose handles and clasp', 'Pick straps and gold or silver hardware for the bag maker.'],
    ],
  },
};

const collections = [
  { name: 'Wedding guest', src: weddingLook, alt: 'Saved kente wedding guest outfit', note: 'Ask for a longer slit and puff sleeves.', fav: true },
  { name: 'Church Sunday', src: churchHeel, alt: 'Saved wax print heel', note: 'Block heel, not too high.', fav: false },
  { name: 'Office', src: officeBag, alt: 'Saved wax print handbag', note: 'Line the inside in plain black.', fav: true },
];

function Cta({ label }: { label: string }) {
  return <><Button asChild size="lg" className="mt-8"><Link to="/auth">{label}</Link></Button><p className="mt-3 text-sm text-muted-foreground">Start with three free images. Saved designs stay in your account.</p></>;
}

function Steps({ heading, steps }: { heading: string; steps: Step[] }) {
  return <section className="mt-10 border-t border-border pt-8"><h2 className="text-3xl">{heading}</h2><ol className="mt-5 grid gap-6 md:grid-cols-3">{steps.map(([title, text], i) => <li key={title}><p className="text-sm text-muted-foreground">0{i + 1}</p><h3 className="mt-2 text-2xl">{title}</h3><p className="mt-2 text-sm">{text}</p></li>)}</ol></section>;
}

function WardrobePreview() {
  return <main className="mx-auto max-w-6xl px-5 py-12">
    <p className="text-xs uppercase tracking-widest text-muted-foreground">Wardrobe</p>
    <h1 className="mt-3 text-4xl sm:text-5xl">Your designs, sorted by occasion</h1>
    <p className="mt-3 max-w-xl text-muted-foreground">Group saved looks into collections. Mark favourites, add notes for your tailor and share a design in one tap.</p>
    <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {collections.map((c) => <article key={c.name} className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between"><h2 className="text-xl">{c.name}</h2>
          <Heart aria-label={c.fav ? 'Favourite' : 'Not a favourite'} className={`h-5 w-5 ${c.fav ? 'fill-primary text-primary' : 'text-muted-foreground'}`} /></div>
        <img src={c.src} width={384} height={384} loading="lazy" alt={c.alt} className="mt-3 aspect-square w-full rounded-md object-cover" />
        <p className="mt-3 flex gap-2 text-sm"><NotebookPen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span><span className="text-muted-foreground">Tailor note: </span>{c.note}</span></p>
        <span className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground"><Share2 className="h-4 w-4" />Share</span>
      </article>)}
    </div>
    <p className="mt-3 text-xs text-muted-foreground">Example collections. Your wardrobe fills up as you save designs.</p>
    <Steps heading="How your wardrobe works" steps={[
      ['Save a design', 'Tap save on any outfit, shoe or bag you like.'],
      ['File it by occasion', 'Put it in a collection like Wedding guest or Office.'],
      ['Brief your tailor', 'Add a note, then share it on WhatsApp before your fitting.'],
    ]} />
    <Cta label="Sign in to start your wardrobe" />
  </main>;
}

export function DesignPreview({ kind = 'outfits', wardrobe = false }: { kind?: DesignKind; wardrobe?: boolean }) {
  if (wardrobe) return <WardrobePreview />;
  const p = previews[kind];
  return <main className="mx-auto max-w-6xl px-5 py-12">
    <p className="text-xs uppercase tracking-widest text-muted-foreground">{p.eyebrow}</p>
    <h1 className="mt-3 text-4xl sm:text-5xl">{p.title}</h1>
    <p className="mt-3 max-w-xl text-muted-foreground">{p.intro}</p>
    <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr]">
      <figure><img src={p.fabric.src} width={384} height={384} alt={p.fabric.alt} className="aspect-square w-full rounded-lg object-cover" /><figcaption className="mt-2 text-sm">{p.fabric.caption}</figcaption></figure>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{p.designs.map((d) => <figure key={d.src}><img src={d.src} width={384} height={384} loading="lazy" alt={d.alt} className="aspect-square w-full rounded-lg object-cover" /><figcaption className="mt-2 text-sm">{d.caption}</figcaption></figure>)}</div>
    </div>
    <p className="mt-3 text-xs text-muted-foreground">These are AI examples. Your designs depend on the fabric and options you choose.</p>
    <Steps heading="How it works" steps={p.steps} />
    <Cta label="Sign in or create an account" />
  </main>;
}
