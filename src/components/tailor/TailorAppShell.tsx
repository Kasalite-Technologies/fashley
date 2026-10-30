import { Link } from "@tanstack/react-router";
import { FolderOpen, Menu, Plus, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { to: "/tailor" as const, label: "Projects", icon: FolderOpen },
  { to: "/tailor/new" as const, label: "New project", icon: Plus },
  { to: "/account" as const, label: "Account", icon: UserRound },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Tailor" className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Button key={item.to} asChild variant="ghost" className="min-h-11 justify-start">
          <Link to={item.to} onClick={onNavigate}>
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex gap-8">
        <aside className="hidden w-52 shrink-0 md:block" aria-label="Tailor navigation">
          <p className="mb-4 text-sm font-semibold">Fashley Tailor</p>
          <NavLinks />
        </aside>
        <div className="min-w-0 flex-1">
          <header className="mb-6 flex flex-wrap items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="min-h-11 min-w-11 md:hidden"
                  aria-label="Open tailor navigation"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetTitle>Fashley Tailor</SheetTitle>
                <div className="mt-6">
                  <NavLinks onNavigate={() => setOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
              <ol className="flex flex-wrap items-center gap-2">
                <li>
                  <Link to="/tailor" className="underline-offset-4 hover:underline">
                    Projects
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
          <h1 className="text-3xl">{title}</h1>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
