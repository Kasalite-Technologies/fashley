import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, ImagePlus, RefreshCw, Sparkles, AlertTriangle, Bookmark, Share2, Loader2, ShoppingBag, Eye, Download, Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { prepareFabric, dataUrlToBlob, type FabricCheck } from "@/lib/fabric";
import { streamImage } from "@/lib/stream-image";
import { suggestAccessories, type Accessories } from "@/lib/accessories.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { DesignPreview } from "@/components/DesignPreview";
import { BackButton } from "@/components/BackButton";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DESIGN_OPTIONS, HARDWARE, type DesignKind } from "@/lib/design-options";
import { designMetadata, type DesignPreferences, type DesignResult } from "@/lib/design-result";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PinterestInspiration } from "@/components/PinterestInspiration";
import { useCoins } from "@/lib/use-coins";
import { generationQuote } from "@/lib/coin-rules";
import { DesignShareSheet } from "@/components/DesignShareSheet";

const OCCASIONS = ["Everyday", "Office", "Wedding guest", "Party", "Church / Sunday", "Photoshoot"];
const MIN_OUTPUTS = 2;
const MAX_OUTPUTS = 4;

function Chips({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Button
          variant="outline"
          aria-pressed={value === i}
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={cn(
            "rounded-full border px-4 py-2 text-sm transition-colors",
            value === i ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent",
          )}
        >
          {i}
        </Button>
      ))}
    </div>
  );
}

export function DesignStudio({ kind = "outfits" }: { kind?: DesignKind }) {
  const options = DESIGN_OPTIONS[kind];
  const { session, loading } = useAuth();
  const coinAccount = useCoins();
  const coinData = coinAccount.data;
  const coinCost = coinData?.settings?.generation_cost ?? 1;
  const [count, setCount] = useState(3);
  const quote = generationQuote(coinData?.wallet.free_used ?? 3, coinData?.wallet.balance ?? 0, coinCost, count);
  const [fabric, setFabric] = useState<FabricCheck | null>(null);
  const [category, setCategory] = useState<string>(options.categories[0] ?? "Dress");
  const [occasion, setOccasion] = useState<string>(OCCASIONS[0] ?? "Everyday");
  const [style, setStyle] = useState<string>(options.styles[0] ?? "Elegant");
  const [hardware, setHardware] = useState("Gold");
  const [detail, setDetail] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [results, setResults] = useState<DesignResult[]>([]);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [accessories, setAccessories] = useState<Record<number, Accessories>>({});
  const [accLoading, setAccLoading] = useState(false);
  const [accError, setAccError] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => { if (!running) return; setElapsed(0); const timer=setInterval(()=>setElapsed(t=>t+1),1000); return ()=>clearInterval(timer); }, [running]);
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const savingRef = useRef(new Set<number>());
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  async function onFile(f?: File) {
    if (!f || busyRef.current) return;
    try {
      const checked = await prepareFabric(f);
      setFabric(checked);
      if (galleryRef.current) galleryRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function currentPreferences(): DesignPreferences {
    return { kind, category, occasion, style, hardware, notes };
  }

  async function runOne(index: number, preferences: DesignPreferences) {
    if (!fabric || !session) return;
    setSaved((s) => ({ ...s, [index]: false }));
    setAccessories((a) => { const next = { ...a }; delete next[index]; return next; });
    setResults((r) => r.map((x, i) => (i === index ? { src: "", final: false, preferences } : x)));
    const form = new FormData();
    form.append("image", fabric.file);
    form.append("preferences", JSON.stringify({ ...preferences, variant: index }));
    form.append("size", kind === "outfits" ? "1024x1536" : "1024x1024");
    form.append("quality", "medium");
    form.append("generation_id", crypto.randomUUID());
    try {
      await streamImage(
        "/api/edit-image",
        form,
        (src, final) => setResults((r) => r.map((x, i) => (i === index ? { src, final, preferences } : x))),
        undefined,
        { Authorization: `Bearer ${session.access_token}` },
      );
    } catch (e) {
      const msg = (e as Error).message;
      const friendly = /coin|balance|free allowance/i.test(msg) ? "Your balance doesn’t cover this image. Please check your coins." : "We couldn’t finish this design. Please try again. Reserved coins or free images are returned.";
      setResults((r) => r.map((x, i) => (i === index ? { src: x.src, final: false, preferences, error: friendly } : x)));
    }
  }

  async function generate() {
    if (busyRef.current || savingRef.current.size || !fabric || !session) return;
    if (!coinData || !quote.affordable) return;
    busyRef.current = true;
    const preferences = currentPreferences();
    const variants = Array.from({ length: count }, (_, i) => i);
    setResults(variants.map(() => ({ src: "", final: false, preferences })));
    setSelected(null);
    setAccessories({});
    setSaved({});
    setRunning(true);
    try { await Promise.all(variants.map((_, i) => runOne(i, preferences))); }
    finally { try { await coinAccount.refetch(); } finally { busyRef.current = false; setRunning(false); } }
  }

  async function regenerate(index: number) {
    if (busyRef.current || savingRef.current.size || !fabric || !session) return;
    if (!coinData) return;
    const singleQuote = generationQuote(coinData.wallet.free_used, coinData.wallet.balance, coinCost, 1);
    if (!singleQuote.affordable) { toast.error("Buy FASHLEY Coins to generate another image."); return; }
    if (!window.confirm(singleQuote.coins ? `${singleQuote.coins} FASHLEY Coins will be deducted for this image. Continue?` : "Use 1 free generation for this image?")) return;
    busyRef.current = true;
    setRunning(true);
    setDetail(null);
    try { await runOne(index, currentPreferences()); }
    finally { try { await coinAccount.refetch(); } finally { busyRef.current = false; setRunning(false); } }
  }

  async function getAccessories(i: number) {
    const result = results[i];
    if (!result?.final) return;
    setSelected(i);
    if (accessories[i]) return;
    setAccLoading(true);
    setAccError(false);
    try {
      const acc = await suggestAccessories({
        data: { category: result.preferences.category, occasion: result.preferences.occasion, style: result.preferences.style, fabricNotes: result.preferences.notes, imageDataUrl: result.src },
      });
      setAccessories((a) => ({ ...a, [i]: acc }));
    } catch (e) {
      setAccError(true);
    }
    setAccLoading(false);
  }

  async function save(i: number) {
    const result = results[i];
    if (!session || !result?.final || saved[i] || savingRef.current.has(i) || busyRef.current) return;
    savingRef.current.add(i);
    setSaving((s) => ({ ...s, [i]: true }));
    try {
    const uid = session.user.id;
    const path = `${uid}/${crypto.randomUUID()}.png`;
    const blob = await dataUrlToBlob(result.src);
    const up = await supabase.storage.from("designs").upload(path, blob, { contentType: "image/png" });
    if (up.error) { toast.error(up.error.message); return; }
    const { error } = await supabase.from("designs").insert({
      image_path: path,
      ...designMetadata(result.preferences),
      accessories: (accessories[i] ?? null) as never,
    });
    if (error) { await supabase.storage.from("designs").remove([path]); toast.error(error.message); return; }
    setSaved((s) => ({ ...s, [i]: true }));
    toast.success("Saved to your wardrobe");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This design couldn't be saved.");
    } finally {
      savingRef.current.delete(i);
      setSaving((s) => ({ ...s, [i]: false }));
    }
  }

  const [shareSrc, setShareSrc] = useState<string | null>(null);

  function download(i: number) {
    const result = results[i];
    if (!result?.final) return;
    const a = document.createElement("a");
    a.href = result.src;
    a.download = `fashley-${kind}-design.png`;
    a.click();
  }

  if (!loading && !session) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <DesignPreview kind={kind} />
      </div>
    );
  }

  if (loading) return <div><SiteHeader/><main className="mx-auto max-w-6xl px-5 py-12" role="status">Loading your design studio…</main></div>;

  const sel = selected !== null ? accessories[selected] : undefined;
  const detailResult = detail !== null ? results[detail] : undefined;
  const savingAny = Object.values(saving).some(Boolean);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <BackButton fallback="/" label="Back" className="mb-6" />
        <h1 className="text-5xl">{options.title}</h1>
        <nav aria-label="Design type" className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant={kind === "outfits" ? "default" : "outline"}><Link to="/studio">Outfits</Link></Button>
          <Button asChild variant={kind === "shoes" ? "default" : "outline"}><Link to="/shoe-design">Shoes</Link></Button>
          <Button asChild variant={kind === "bags" ? "default" : "outline"}><Link to="/bag-design">Bags</Link></Button>
        </nav>

        <p className="mt-2 text-muted-foreground">{kind === "outfits" ? "See outfit ideas in your fabric." : "Choose a shape for your fabric or leather."}</p>
        {kind !== "outfits" && <PinterestInspiration kind={kind} category={category} style={style} />}

        <div className="mt-10 grid gap-10 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-8">
            <fieldset disabled={running || savingAny} className="space-y-8">
            <section>
              <h2 className="text-2xl">1. Your {options.material}</h2>
              <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              {fabric ? (
                <div className="mt-4">
                  <img src={fabric.previewUrl} alt={`Your ${options.material}`} className="aspect-square w-full rounded-xl object-cover" />
                  {fabric.warnings.map((w) => (
                    <p key={w} className="mt-2 flex items-start gap-2 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
                    </p>
                  ))}
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => galleryRef.current?.click()}>Replace</Button>
                    <Button variant="outline" size="sm" onClick={() => cameraRef.current?.click()}>Retake</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => galleryRef.current?.click()} className="flex h-auto aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-blush/60 text-sm hover:bg-blush">
                    <ImagePlus className="h-6 w-6" /> Upload photo
                  </Button>
                  <Button variant="outline" onClick={() => cameraRef.current?.click()} className="flex h-auto aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-sand/60 text-sm hover:bg-sand">
                    <Camera className="h-6 w-6" /> Take photo
                  </Button>
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Images are stored privately and only used to create your designs.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl">2. Your look</h2>
              <div>
                <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{options.label}</p>
                <Chips items={options.categories} value={category} onChange={setCategory} />
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Occasion</p>
                <Chips items={OCCASIONS} value={occasion} onChange={setOccasion} />
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Style</p>
                <Chips items={options.styles} value={style} onChange={setStyle} />
              </div>
              {kind !== "outfits" && <div><p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Hardware</p><Chips items={HARDWARE} value={hardware} onChange={setHardware} /></div>}
              <Input aria-label="Extra design details" placeholder={options.example} value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} />
            </section>

            </fieldset>
            <div>
              <p id="output-count" className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Number of designs</p>
              <div role="group" aria-labelledby="output-count" className="inline-flex items-center gap-3 rounded-full border border-border p-1">
                <Button size="icon" variant="ghost" className="rounded-full" aria-label="Fewer designs" disabled={running || count <= MIN_OUTPUTS} onClick={() => setCount((c) => Math.max(MIN_OUTPUTS, c - 1))}><Minus className="h-4 w-4" /></Button>
                <span className="w-6 text-center font-medium" aria-live="polite">{count}</span>
                <Button size="icon" variant="ghost" className="rounded-full" aria-label="More designs" disabled={running || count >= MAX_OUTPUTS} onClick={() => setCount((c) => Math.min(MAX_OUTPUTS, c + 1))}><Plus className="h-4 w-4" /></Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Choose 2 to 4 designs.</p>
            </div>
            <div className="space-y-3 border-y border-border py-5">
              <div className="flex items-center justify-between gap-3"><p className="font-medium">FASHLEY Coins</p><Button asChild size="sm" variant="outline"><Link to="/coins">Buy Coins</Link></Button></div>
              {coinAccount.error ? <p role="alert" className="text-sm text-destructive">{coinAccount.error.message}</p> : !coinData ? <p className="text-sm text-muted-foreground">Loading balance…</p> : <>
                <p className="text-sm">Current coin balance: <strong>{coinData.wallet.balance}</strong></p>
                <p className="text-sm">Cost per image: {coinCost} coin{coinCost === 1 ? '' : 's'} · {Math.max(0, 3 - coinData.wallet.free_used)} free remaining</p>
                <p className="text-sm text-muted-foreground" aria-live="polite">{quote.coins} coins will be deducted for {count} images{quote.free ? ` (${quote.free} free)` : ''}.</p>
                {!quote.affordable && <p className="text-sm text-destructive">Your free allowance or balance does not cover {count} images. Buy coins to continue.</p>}
              </>}
            </div>
            <Button size="lg" className="w-full rounded-full" disabled={!fabric || !session || running || savingAny || !coinData || !quote.affordable} onClick={generate}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {running ? "Designing…" : quote.coins ? "Generate with Coins" : results.length ? "Generate again" : `Generate ${count} designs`}
            </Button>
          </aside>

          <section>
            {results.length === 0 ? (
              <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl bg-blush/50 p-10 text-center text-muted-foreground">
                {kind === "outfits" ? "Your outfit designs" : kind === "shoes" ? "Your shoe designs" : "Your bag designs"}
              </div>
            ) : (
              <>
                {running && <div role="status" aria-live="polite" className="mb-4 space-y-2"><p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin"/>{elapsed < 10 ? 'Reading your fabric photo…' : elapsed < 35 ? 'Drawing your design ideas…' : 'Adding the pattern and details…'}</p><p className="text-xs text-muted-foreground">{results.filter(r=>r.final).length} of {results.length} designs complete · {elapsed}s elapsed. This usually takes 30 to 90 seconds.</p></div>}
                {!running && (
                  <div className="mb-3 flex justify-end">
                    <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => { setResults([]); setSelected(null); setAccessories({}); setSaved({}); }}>Clear designs</Button>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {results.map((r, i) => (
                    <div key={i} className={cn("rounded-2xl border bg-card p-2", selected === i && "ring-2 ring-primary")}>
                      <div className={cn("relative overflow-hidden rounded-lg bg-muted", kind === "outfits" ? "aspect-[2/3]" : "aspect-square")}>
                        {r.src ? (
                          <img src={r.src} alt={`${options.title} concept ${i + 1}`} className={cn("h-full w-full object-cover transition-[filter] duration-500", r.final ? "blur-0" : "blur-2xl")} />
                        ) : (
                          !r.error && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-sand p-4 text-center"><Loader2 className="h-6 w-6 animate-spin"/><p className="text-sm">Drawing design {i+1}…</p></div>
                        )}
                        {r.error && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/90 p-4 text-center text-sm">
                            {r.error}
                            <Button size="sm" variant="outline" disabled={running || savingAny} onClick={() => regenerate(i)}>Retry</Button>
                          </div>
                        )}
                      </div>
                      {r.final && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Button size="icon" variant="ghost" aria-label="View design" disabled={running} onClick={() => setDetail(i)}><Eye className="h-4 w-4" /></Button>
                          <Button size="sm" variant="outline" onClick={() => download(i)}><Download className="h-4 w-4" />Download image</Button>
                          {kind === "outfits" && <Button size="sm" variant={selected === i ? "default" : "outline"} onClick={() => getAccessories(i)}>
                            <ShoppingBag className="mr-1 h-3.5 w-3.5" /> Style
                          </Button>}
                          <Button size="icon" variant="ghost" aria-label="Save" disabled={saved[i] || saving[i] || running} onClick={() => save(i)}>
                            <Bookmark className={cn("h-4 w-4", saved[i] && "fill-current")} />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setShareSrc(r.src)}>
                            <Share2 className="h-4 w-4" />Share
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="Regenerate" disabled={running || savingAny} onClick={() => regenerate(i)}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      )}


                    </div>
                  ))}
                </div>

                {selected !== null && (
                  <div className="mt-8 rounded-2xl bg-sand/50 p-6">
                    <h2 className="text-3xl">Shoes and bags to match</h2>
                    {accLoading && !sel ? (
                      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Finding shoes and bags…</p>
                    ) : accError ? <div className="mt-4"><p role="alert">We couldn’t find matching accessories. Try again in a moment.</p><Button className="mt-3" variant="outline" onClick={()=>getAccessories(selected)}>Retry suggestions</Button></div> : sel ? (
                      <>
                        <div className="mt-4 grid gap-6 md:grid-cols-2">
                          {(["shoes", "bags"] as const).map((k) => (
                            <div key={k}>
                              <p className="text-xs uppercase tracking-widest text-muted-foreground">{k === "shoes" ? "Shoes" : "Handbags"}</p>
                              <ul className="mt-2 space-y-3">
                                {sel[k].map((it) => (
                                  <li key={it.name} className="rounded-xl bg-card p-3">
                                    <p className="font-medium">{it.name} <span className="text-muted-foreground">· {it.color}</span></p>
                                    <p className="text-sm text-muted-foreground">{it.why}</p>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                        <p className="mt-4 font-display text-xl italic">“{sel.tip}”</p>
                        <p className="mt-2 text-xs text-muted-foreground">Save this design now to keep these suggestions with it.</p>
                      </>
                    ) : null}
                  </div>
                )}
                <p className="mt-6 text-xs text-muted-foreground">These designs are ideas, not sewing patterns. Fit is not guaranteed. Check the design with a tailor or craftsperson before making it.</p>
              </>
            )}
          </section>
        </div>
      </main>
      <Dialog open={detail !== null} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogTitle>{detailResult?.preferences.category} · Concept {detail !== null ? detail + 1 : ""}</DialogTitle>
          <DialogDescription>{detailResult?.preferences.style} · {detailResult?.preferences.occasion}{kind !== "outfits" ? ` · ${detailResult?.preferences.hardware} hardware` : ""}</DialogDescription>
          {detailResult?.src && <img src={detailResult.src} alt={`${detailResult.preferences.category} design detail`} className="max-h-[55dvh] w-full rounded-lg object-contain" />}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setDetail(null); galleryRef.current?.scrollIntoView(); }} variant="outline">Edit design</Button>
            <Button onClick={() => { if (detail !== null) download(detail); }}><Download />Download image</Button>
            <Button variant="outline" onClick={() => { if (detailResult?.src) setShareSrc(detailResult.src); }}><Share2 />Share</Button>
            <Button variant="outline" disabled={running || (detail !== null && (saved[detail] || saving[detail]))} onClick={() => { if (detail !== null) save(detail); }}><Bookmark />Save</Button>
          </div>
        </DialogContent>
      </Dialog>
      <DesignShareSheet
        open={shareSrc !== null}
        onOpenChange={(o) => !o && setShareSrc(null)}
        title={`My Fashley ${kind === "shoes" ? "shoe" : kind === "bags" ? "bag" : "outfit"} design`}
        imageSrc={shareSrc}
      />
    </div>
  );
}
