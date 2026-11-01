import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/tanstack-react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { DesignPreview } from "@/components/DesignPreview";
import { TailorSignInPanel, clerkConfigured } from "@/components/tailor/TailorClerk";
import { Button } from "@/components/ui/button";

interface SavedDesign {
  id: string;
  kind: string;
  category: string;
  style: string;
  occasion: string;
  createdAt: string;
}

function Wardrobe() {
  const { getToken } = useAuth();
  const [items, setItems] = useState<SavedDesign[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch("/api/studio/designs", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: { items: SavedDesign[] };
        error?: { message?: string };
      } | null;
      if (!res.ok || !payload?.data) throw new Error(payload?.error?.message ?? "Your wardrobe could not be loaded.");
      setItems(payload.data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your wardrobe could not be loaded.");
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    try {
      const token = await getToken();
      const res = await fetch(`/api/studio/designs/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("This design could not be deleted.");
      setItems((prev) => (prev ?? []).filter((d) => d.id !== id));
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This design could not be deleted.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="font-sans text-4xl font-semibold tracking-tight">Your designs</h1>
      {error && <p role="alert" className="mt-6 text-sm text-destructive">{error}</p>}
      {items === null && !error && <p className="mt-6 text-sm text-muted-foreground" role="status">Loading your designs…</p>}
      {items !== null && items.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">No saved designs yet. Generate one in the studio and tap Save.</p>
      )}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(items ?? []).map((d) => (
          <article key={d.id} className="rounded-lg border border-border bg-card p-3">
            <img
              src={`/api/studio/designs/${d.id}`}
              alt={`Saved ${d.kind} design: ${d.category}`}
              loading="lazy"
              className="aspect-square w-full rounded-md object-cover"
            />
            <h2 className="mt-3 font-sans text-lg font-semibold tracking-tight">{d.category}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {d.style}{d.occasion ? ` · ${d.occasion}` : ""} · {new Date(d.createdAt).toLocaleDateString()}
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => void remove(d.id)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </article>
        ))}
      </div>
    </main>
  );
}

function WardrobeGateInner() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return <main className="mx-auto max-w-6xl px-5 py-12" role="status">Loading your wardrobe…</main>;
  }
  if (!isSignedIn) {
    return (
      <>
        <DesignPreview wardrobe />
        <section className="mx-auto max-w-md px-5 pb-16">
          <h2 className="font-sans text-2xl font-semibold tracking-tight">Sign in to see your designs</h2>
          <div className="mt-4">
            <TailorSignInPanel />
          </div>
        </section>
      </>
    );
  }
  return <Wardrobe />;
}

export function WardrobeApp() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      {clerkConfigured ? (
        <WardrobeGateInner />
      ) : (
        <>
          <DesignPreview wardrobe />
          <section className="mx-auto max-w-md px-5 pb-16">
            <TailorSignInPanel />
          </section>
        </>
      )}
    </div>
  );
}
