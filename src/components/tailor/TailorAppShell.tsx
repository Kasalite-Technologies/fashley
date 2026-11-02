import { Link } from "@tanstack/react-router";
import { FolderOpen, Menu, Plus, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import "@/styles/workspace.css";

export const TAILOR_BRAND_LABEL = "Fashley / My outfits";

const NAV = [
  { to: "/studio" as const, label: "Design studio", icon: Plus },
  { to: "/wardrobe" as const, label: "Wardrobe", icon: FolderOpen },
  { to: "/tailor" as const, label: "My outfit projects", icon: FolderOpen },
  { to: "/tailor/new" as const, label: "Start a new outfit", icon: Plus },
  { to: "/account" as const, label: "Account", icon: UserRound },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="My outfits" className="atelier-nav flex flex-col gap-1">
      {NAV.map((item) => (
        <Button key={item.to} asChild variant="ghost" className="min-h-11 justify-start">
          <Link
            to={item.to}
            onClick={onNavigate}
            activeOptions={{ exact: true }}
            activeProps={{ className: "bg-accent text-accent-foreground" }}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" /> {item.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}

export function TailorAppShell({
  title,
  projectTitle,
  children,
}: {
  title: string;
  projectTitle?: string | null | undefined;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="atelier workspace-shell">
      <div className="workspace-layout">
        <aside className="workspace-sidebar hidden md:block" aria-label="My outfits navigation">
          <Link to="/" className="workspace-brand">
            Fashley
          </Link>
          <NavLinks />
          <p className="workspace-sidebar-note">
            From the first idea
            <br />
            to the final fitting.
          </p>
        </aside>
        <main className="workspace-main min-w-0 flex-1">
          <header className="mb-6 flex flex-wrap items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="min-h-11 min-w-11 md:hidden"
                  aria-label="Open my outfits navigation"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="atelier">
                <SheetTitle>{TAILOR_BRAND_LABEL}</SheetTitle>
                <div className="mt-6">
                  <NavLinks onNavigate={() => setOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
              <ol className="flex flex-wrap items-center gap-2">
                <li>
                  <Link to="/tailor" className="underline-offset-4 hover:underline">
                    My outfit projects
                  </Link>
                </li>
                {projectTitle ? (
                  <>
                    <li aria-hidden="true">/</li>
                    <li aria-current="page" className="text-foreground">
                      {projectTitle}
                    </li>
                  </>
                ) : null}
              </ol>
            </nav>
          </header>
          <h1 className="workspace-title">{title}</h1>
          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
