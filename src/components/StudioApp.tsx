import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useAuth } from "@clerk/tanstack-react-start";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { StudioShell } from "@/components/StudioShell";
import { DesignPreview } from "@/components/DesignPreview";
import { TailorSignInPanel, clerkConfigured } from "@/components/tailor/TailorClerk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DESIGN_OPTIONS, HARDWARE, type DesignKind } from "@/lib/design-options";
import { prepareFabric, type FabricCheck } from "@/lib/fabric";

const OCCASIONS = ["Everyday", "Work", "Church", "Wedding", "Party", "Formal event"];
const KIND_ROUTES = {
  outfits: "/studio",
  shoes: "/shoe-design",
  bags: "/bag-design",
} as const satisfies Record<DesignKind, string>;

interface Preferences {
  kind: DesignKind;
  category: string;
  occasion: string;
  style: string;
  hardware: string;
  notes: string;
}

interface GeneratedImage {
  imageBase64: string;
  preferences: Preferences;
}

async function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("This file could not be read."));
    reader.readAsDataURL(file);
  });
}

function SignedOutStudio({ kind }: { kind: DesignKind }) {
  return (
    <>
      <DesignPreview kind={kind} />
      <section className="mx-auto max-w-md px-5 pb-16">
        <h2 className="font-sans text-2xl font-semibold tracking-tight">Sign in to design</h2>
        <div className="mt-4">
          <Button asChild size="lg">
            <Link to="/sign-in" search={{ redirectTo: KIND_ROUTES[kind], mode: "in" }}>
              Sign in to design
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function Studio({ kind }: { kind: DesignKind }) {
  const { getToken } = useAuth();
  const options = DESIGN_OPTIONS[kind];
  const [fabric, setFabric] = useState<FabricCheck | null>(null);
  const [category, setCategory] = useState(options.categories[0] ?? "");
  const [style, setStyle] = useState(options.styles[0] ?? "");
  const [occasion, setOccasion] = useState(OCCASIONS[0] ?? "Everyday");
  const [hardware, setHardware] = useState("Gold");
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState(3);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function authHeaders() {
    const token = await getToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function onFile(file?: File) {
    if (!file) return;
    try {
      setFabric(await prepareFabric(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This file could not be read.");
    }
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Drop an image file, such as a JPG or PNG photo.");
      return;
    }
    void onFile(file);
  }

  async function generate() {
    if (!fabric || running) return;
    setRunning(true);
    setResults([]);
    setSaved({});
    try {
      const preferences: Preferences = { kind, category, occasion, style, hardware, notes };
      const imageDataUrl = await readAsDataUrl(fabric.file);
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ imageDataUrl, preferences, count }),
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: { images: { imageBase64: string }[]; warnings?: string[] };
        error?: { message?: string };
      } | null;
      if (!res.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? "Generation failed. Please try again.");
      }
      setResults(payload.data.images.map((img) => ({ imageBase64: img.imageBase64, preferences })));
      for (const w of payload.data.warnings ?? []) toast.warning(w);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  async function save(index: number) {
    const result = results[index];
    if (!result || saved[index] || saving[index]) return;
    setSaving((s) => ({ ...s, [index]: true }));
    try {
      const res = await fetch("/api/studio/designs", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ imageBase64: result.imageBase64, preferences: result.preferences }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!res.ok) throw new Error(payload?.error?.message ?? "This design could not be saved.");
      setSaved((s) => ({ ...s, [index]: true }));
      toast.success("Saved to your wardrobe");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This design could not be saved.");
    } finally {
      setSaving((s) => ({ ...s, [index]: false }));
    }
  }

  function download(index: number) {
    const result = results[index];
    if (!result) return;
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${result.imageBase64}`;
    a.download = `fashley-${kind}-design-${index + 1}.png`;
    a.click();
  }

  return (
    <StudioShell title={`${options.title} studio`}>
      <div className="grid gap-10 lg:grid-cols-[320px_1fr]">
        <section>
          <h2 className="font-sans text-lg font-semibold tracking-tight">1. Your {options.material} photo</h2>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label={`Upload your ${options.material} photo`}
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div
            role="button"
            tabIndex={0}
            aria-label={
              fabric
                ? `Change your ${options.material} photo`
                : `Upload your ${options.material} photo by clicking or dropping a file`
            }
            className={`mt-3 cursor-pointer rounded-lg border border-dashed p-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
              dragging ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
            }`}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {fabric ? (
              <img
                src={fabric.previewUrl}
                alt="Your uploaded material"
                className="aspect-square w-full rounded-md object-cover"
              />
            ) : (
              <p className="flex aspect-square w-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                Drag and drop your {options.material} photo here, or click to upload
              </p>
            )}
          </div>
          {fabric &&
            fabric.warnings.map((w) => (
              <p key={w} className="mt-2 text-sm text-muted-foreground">
                {w}
              </p>
            ))}

          <h2 className="mt-8 font-sans text-lg font-semibold tracking-tight">2. Design choices</h2>
          <div className="mt-3 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="studio-category">{options.label}</Label>
              <select id="studio-category" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                {options.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="studio-style">Style</Label>
              <select id="studio-style" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={style} onChange={(e) => setStyle(e.target.value)}>
                {options.styles.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="studio-occasion">Occasion</Label>
              <select id="studio-occasion" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={occasion} onChange={(e) => setOccasion(e.target.value)}>
                {OCCASIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {kind !== "outfits" && (
              <div className="space-y-1.5">
                <Label htmlFor="studio-hardware">Hardware</Label>
                <select id="studio-hardware" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={hardware} onChange={(e) => setHardware(e.target.value)}>
                  {HARDWARE.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="studio-notes">Extra details (optional)</Label>
              <Input id="studio-notes" value={notes} maxLength={200} placeholder={options.example} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>How many designs</Label>
              <div className="flex gap-2" role="group" aria-label="How many designs">
                {[2, 3, 4].map((n) => (
                  <Button key={n} type="button" size="sm" variant={count === n ? "default" : "outline"} onClick={() => setCount(n)} aria-pressed={count === n}>
                    {n}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <Button className="mt-6 w-full" size="lg" disabled={!fabric || running} onClick={() => void generate()}>
            {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : "Generate designs"}
          </Button>
          {!fabric && <p className="mt-2 text-sm text-muted-foreground">Upload a photo first.</p>}
        </section>

        <section aria-live="polite">
          <h2 className="font-sans text-lg font-semibold tracking-tight">3. Your designs</h2>
          {running && <p className="mt-4 text-sm text-muted-foreground" role="status">Generating your designs. This can take a minute.</p>}
          {!running && results.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">Nothing yet. Your designs will appear here.</p>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {results.map((r, i) => (
              <figure key={i} className="rounded-lg border border-border bg-card p-3">
                <img src={`data:image/png;base64,${r.imageBase64}`} alt={`Generated ${kind} design ${i + 1}`} className="aspect-square w-full rounded-md object-cover" />
                <figcaption className="mt-2 text-sm text-muted-foreground">
                  {r.preferences.category} · {r.preferences.style}
                </figcaption>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" disabled={saved[i] || saving[i]} onClick={() => void save(i)}>
                    {saved[i] ? "Saved" : saving[i] ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => download(i)}>
                    <Download className="h-4 w-4" /> Download
                  </Button>
                </div>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </StudioShell>
  );
}

export function StudioApp({ kind }: { kind: DesignKind }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-5 py-12" role="status">Loading your design studio…</main>
      </div>
    );
  }
  if (isSignedIn) {
    return (
      <div className="min-h-screen">
        <Studio kind={kind} />
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <SignedOutStudio kind={kind} />
    </div>
  );
}

export function StudioGate({ kind }: { kind: DesignKind }) {
  if (!clerkConfigured) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <DesignPreview kind={kind} />
        <section className="mx-auto max-w-md px-5 pb-16">
          <TailorSignInPanel redirectTo={KIND_ROUTES[kind]} />
        </section>
      </div>
    );
  }
  return <StudioApp kind={kind} />;
}
