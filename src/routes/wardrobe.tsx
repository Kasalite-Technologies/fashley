import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2, Share2, Download } from "lucide-react";
import { DesignShareSheet } from "@/components/DesignShareSheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import type { Accessories } from "@/lib/accessories.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { DesignPreview } from "@/components/DesignPreview";
import { BackButton } from "@/components/BackButton";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/wardrobe")({
  head: () => ({
    meta: [
      { title: "My wardrobe | Fashley" },
      { name: "description", content: "Keep your saved designs in collections. Find a favourite outfit or matching bag to show your tailor." },
      { property: "og:title", content: "My wardrobe | Fashley" },
      { property: "og:description", content: "Keep your saved designs in collections. Find a favourite outfit or matching bag to show your tailor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Wardrobe,
});

type Design = {
  id: string;
  image_path: string;
  category: string;
  occasion: string | null;
  style: string | null;
  collection: string;
  accessories: Accessories | null;
  url?: string | null | undefined;
};

function Wardrobe() {
  const { session, loading } = useAuth();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [fetching, setFetching] = useState(true);
  const [open, setOpen] = useState<Design | null>(null);
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data, error } = await supabase.from("designs").select("*").order("created_at", { ascending: false });
      if (error) {
        toast.error(error.message);
        setFetching(false);
        return;
      }
      const rows = (data ?? []) as unknown as Design[];
      if (rows.length) {
        const { data: signed } = await supabase.storage.from("designs").createSignedUrls(rows.map((r) => r.image_path), 3600);
        rows.forEach((r, i) => (r.url = signed?.[i]?.signedUrl));
      }
      setDesigns(rows);
      setFetching(false);
    })();
  }, [session]);

  const collections = useMemo(() => ["All", ...Array.from(new Set(designs.map((d) => d.collection)))], [designs]);
  const shown = filter === "All" ? designs : designs.filter((d) => d.collection === filter);

  async function remove(d: Design) {
    await supabase.storage.from("designs").remove([d.image_path]);
    const { error } = await supabase.from("designs").delete().eq("id", d.id);
    if (error) { toast.error(error.message); return; }
    setDesigns((x) => x.filter((y) => y.id !== d.id));
    setOpen(null);
  }

  async function move(d: Design, collection: string) {
    const name = collection.trim();
    if (!name) return;
    const { error } = await supabase.from("designs").update({ collection: name }).eq("id", d.id);
    if (error) { toast.error(error.message); return; }
    setDesigns((x) => x.map((y) => (y.id === d.id ? { ...y, collection: name } : y)));
    setOpen({ ...d, collection: name });
    toast.success(`Moved to ${name}`);
  }

  if (!loading && !session) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <DesignPreview wardrobe />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <BackButton fallback="/" label="Back" className="mb-6" />
        <h1 className="text-5xl">My wardrobe</h1>

        <div className="mt-6 flex flex-wrap gap-2">
          {collections.map((c) => (
            <button key={c} onClick={() => setFilter(c)} className={`rounded-full border px-4 py-1.5 text-sm ${filter === c ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
              {c}
            </button>
          ))}
        </div>
        {fetching && <p role="status" className="mt-8 text-sm text-muted-foreground">Loading your saved designs…</p>}
        {!fetching && designs.length === 0 && (
          <div className="mt-10 rounded-2xl bg-blush/50 p-12 text-center">
            <p className="text-muted-foreground">No saved designs yet.</p>
            <Button asChild className="mt-4 rounded-full"><Link to="/studio">Start a design</Link></Button>
          </div>
        )}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {shown.map((d) => (
            <button key={d.id} onClick={() => setOpen(d)} className="text-left">
              <img src={d.url ?? undefined} alt={`${d.category} design`} loading="lazy" className="aspect-[2/3] w-full rounded-xl bg-muted object-cover" />
              <p className="mt-2 text-sm">{d.category}</p>
              <p className="text-xs text-muted-foreground">{d.occasion} · {d.collection}</p>
            </button>
          ))}
        </div>
      </main>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-3xl font-medium">{open.category}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 md:grid-cols-2">
                <img src={open.url ?? undefined} alt={`${open.category} design`} className="w-full rounded-xl" />
                <div className="space-y-4 text-sm">
                  <p className="text-muted-foreground">{open.occasion} · {open.style}</p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      move(open, String(new FormData(e.currentTarget).get("c") ?? ""));
                    }}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
                  >
                    <Input name="c" defaultValue={open.collection} placeholder="Collection name" />
                    <Button type="submit" variant="outline">Move</Button>
                  </form>
                  <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setSharePath(open.image_path)}><Share2 />Share</Button><Button variant="outline" disabled={!open.url} onClick={async () => { if (!open.url) return; try {const response = await fetch(open.url); if (!response.ok) throw new Error(); const blob=await response.blob(); const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download='fashley-design.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{toast.error('We couldn’t download this image. Please try again.');}}}><Download/>Download image</Button></div>
                  {open.accessories && (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Shoes</p>
                      {open.accessories.shoes.map((s) => <p key={s.name}>{s.name} · {s.color}</p>)}
                      <p className="pt-2 text-xs uppercase tracking-widest text-muted-foreground">Handbags</p>
                      {open.accessories.bags.map((s) => <p key={s.name}>{s.name} · {s.color}</p>)}
                      <p className="pt-2 font-display text-lg italic">“{open.accessories.tip}”</p>
                    </div>
                  )}
                  <Button variant="ghost" className="text-destructive" onClick={() => remove(open)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete design
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <DesignShareSheet
        open={sharePath !== null}
        onOpenChange={(o) => !o && setSharePath(null)}
        title="My Fashley design"
        imagePath={sharePath}
      />
    </div>
  );
}
