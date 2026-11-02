import { Link } from "@tanstack/react-router";
import { Archive, FolderOpen, Home, Menu, Shirt, ShoppingBag, Footprints } from "lucide-react";
import { useState, type ReactNode } from "react";
import { UserButton } from "@clerk/tanstack-react-start";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import logoUrl from "@/assets/logo.png";

export const STUDIO_BRAND_LABEL = "Fashley Studio";

const NAV = [
  { to: "/studio" as const, label: "Outfit studio", icon: Shirt },
  { to: "/shoe-design" as const, label: "Shoe studio", icon: Footprints },
  { to: "/bag-design" as const, label: "Bag studio", icon: ShoppingBag },
  { to: "/wardrobe" as const, label: "Wardrobe", icon: Archive },
  { to: "/tailor" as const, label: "My outfit projects", icon: FolderOpen },
  { to: "/" as const, label: "Home", icon: Home },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Studio" className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Button key={item.to} asChild variant="ghost" className="min-h-11 justify-start">
          <Link
            to={item.to}
            onClick={onNavigate}
            activeProps={{ className: "bg-accent text-accent-foreground" }}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" /> {item.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}

/**
 * Dashboard shell for the signed-in studio, following the sidebar + header
 * layout pattern: brand and section nav on the left, page title and the
 * Clerk account menu (profile, sign out) in the header. Render only for
 * signed-in users inside the Clerk provider.
 */
export function StudioShell({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex gap-8">
        <aside className="hidden w-56 shrink-0 md:block" aria-label="Studio navigation">
          <Link to="/studio" className="mb-6 flex items-center gap-2">
            <img src={logoUrl} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
            <span className="text-sm font-semibold">{STUDIO_BRAND_LABEL}</span>
          </Link>
          <NavLinks />
        </aside>
        <div className="min-w-0 flex-1">
          <header className="mb-6 flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="min-h-11 min-w-11 md:hidden"
                  aria-label="Open studio navigation"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetTitle>{STUDIO_BRAND_LABEL}</SheetTitle>
                <div className="mt-6">
                  <NavLinks onNavigate={() => setOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <h1 className="min-w-0 flex-1 truncate font-sans text-2xl font-semibold tracking-tight">
              {title}
            </h1>
            <UserButton />
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
