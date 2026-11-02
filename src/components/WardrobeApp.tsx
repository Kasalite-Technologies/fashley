import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/tanstack-react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { StudioShell } from "@/components/StudioShell";
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
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/studio/designs", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: { items: SavedDesign[] };
        error?: { message?: string };
      } | null;
      if (!res.ok || !payload?.data)
        throw new Error(payload?.error?.message ?? "Your wardrobe could not be loaded.");
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
    <>
      <div className="wardrobe-toolbar">
        <p className="workspace-intro">The ideas you kept. Ready when you are.</p>
        <Button asChild>
          <Link to="/studio">Design something new</Link>
        </Button>
      </div>
      {/* Pill filters with real counts, so the size of each category is
          visible before filtering. Counts come from the loaded designs. */}
      <div className="wardrobe-filters" role="group" aria-label="Filter saved designs">
        {["all", "outfits", "bags", "shoes"].map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={filter === kind}
            onClick={() => setFilter(kind)}
          >
            {kind === "all" ? "All designs" : kind}
            <span className="filter-count">
              {kind === "all"
                ? (items ?? []).length
                : (items ?? []).filter((d) => d.kind === kind).length}
            </span>
          </button>
        ))}
      </div>
      {error && (
        <div role="alert" className="mt-6 text-sm text-destructive">
          <p>{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}
      {items === null && !error && (
        <p className="mt-6 text-sm text-muted-foreground" role="status">
          Loading your designs…
        </p>
      )}
      {items !== null && items.length === 0 && (
        <div className="canvas-empty">
          <span>Your collection starts with one idea.</span>
          <p>
            Generate a design in the studio and choose Save. Your favourites will be waiting here.
          </p>
          <Link to="/studio">Open the outfit studio</Link>
        </div>
      )}
      {items && items.length > 0 && !items.some((d) => filter === "all" || d.kind === filter) && (
        <p className="py-12">
          No saved {filter} yet. Choose another category or create a new design.
        </p>
      )}
      <div className="wardrobe-gallery saved-gallery">
        {(items ?? [])
          .filter((d) => filter === "all" || d.kind === filter)
          .map((d) => (
            <article key={d.id} className="wardrobe-card">
              <div className="wardrobe-card-media">
                <img
                  src={`/api/studio/designs/${d.id}`}
                  alt={`Saved ${d.kind} design: ${d.category}`}
                  loading="lazy"
                  width={800}
                  height={800}
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="wardrobe-card-delete"
                  aria-label={`Delete saved ${d.category}`}
                  onClick={() => void remove(d.id)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <h2>{d.category}</h2>
              <p>
                {d.style}
                {d.occasion ? ` · ${d.occasion}` : ""} ·{" "}
                {new Date(d.createdAt).toLocaleDateString()}
              </p>
            </article>
          ))}
      </div>
    </>
  );
}

function WardrobeGateInner() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-5 py-12" role="status">
          Loading your wardrobe…
        </main>
      </>
    );
  }
  if (!isSignedIn) {
    return (
      <>
        <SiteHeader />
        <DesignPreview wardrobe />
        <section className="mx-auto max-w-md px-5 pb-16">
          <h2 className="font-sans text-2xl font-semibold tracking-tight">
            Sign in to see your designs
          </h2>
          <div className="mt-4">
            <Button asChild size="lg">
              <Link to="/sign-in" search={{ redirectTo: "/wardrobe", mode: "in" }}>
                Sign in
              </Link>
            </Button>
          </div>
        </section>
      </>
    );
  }
  return (
    <StudioShell title="Wardrobe">
      <Wardrobe />
    </StudioShell>
  );
}

export function WardrobeApp() {
  if (clerkConfigured) {
    return (
      <div className="min-h-screen">
        <WardrobeGateInner />
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <SiteHeader />
      {
        <>
          <DesignPreview wardrobe />
          <section className="mx-auto max-w-md px-5 pb-16">
            <TailorSignInPanel redirectTo="/wardrobe" />
          </section>
        </>
      }
    </div>
  );
}
