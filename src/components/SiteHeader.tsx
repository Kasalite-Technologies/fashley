import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { useAuth as useClerkAuth } from "@clerk/tanstack-react-start";
import { clerkConfigured } from "@/components/tailor/TailorClerk";
import { Button } from "@/components/ui/button";
import { CartDrawer } from "@/components/CartDrawer";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import logoUrl from "@/assets/logo.png";
import "@/styles/header.css";

const links = [
  ["Home", "/"],
  ["Discover", "/discover"],
  ["Studio", "/studio"],
  ["Wardrobe", "/wardrobe"],
  ["Shop", "/shop"],
] as const;

function isActive(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

function SignInLink({ mobile }: { mobile?: boolean | undefined }) {
  if (mobile)
    return (
      <SheetClose asChild>
        <Button asChild>
          <Link to="/sign-in" search={{ redirectTo: "/studio", mode: "in" }}>
            Sign in
          </Link>
        </Button>
      </SheetClose>
    );
  return (
    <Button asChild variant="outline" size="sm">
      <Link to="/sign-in" search={{ redirectTo: "/studio", mode: "in" }}>
        Sign in
      </Link>
    </Button>
  );
}

function ClerkSignInLink({ mobile }: { mobile?: boolean | undefined }) {
  const { isLoaded, isSignedIn } = useClerkAuth();
  const signedIn = isLoaded && isSignedIn;
  if (signedIn) {
    if (mobile)
      return (
        <SheetClose asChild>
          <Button asChild>
            <Link to="/studio">Open design studio</Link>
          </Button>
        </SheetClose>
      );
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/studio">Open design studio</Link>
      </Button>
    );
  }
  if (mobile)
    return (
      <SheetClose asChild>
        <Button asChild>
          <Link to="/sign-in" search={{ redirectTo: "/studio", mode: "in" }}>
            Sign in
          </Link>
        </Button>
      </SheetClose>
    );
  return (
    <Button asChild variant="outline" size="sm">
      <Link to="/sign-in" search={{ redirectTo: "/studio", mode: "in" }}>
        Sign in
      </Link>
    </Button>
  );
}

// The design studio is the default destination after sign-in, not the
// tailor project list. ClerkProvider is only mounted (by
// TailorClerkProvider in the root route) when a publishable key exists, so
// the Clerk hook must only run in that case; otherwise use the plain link.
function AuthLink({ mobile }: { mobile?: boolean | undefined }) {
  if (!clerkConfigured) return <SignInLink mobile={mobile} />;
  return <ClerkSignInLink mobile={mobile} />;
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = useLocation({ select: (s) => s.pathname });
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  // The indicator measures the active link and slides to it. Home matches
  // exactly, or it would light up on every route.
  useEffect(() => {
    function measure() {
      const index = links.findIndex(([, to]) => isActive(pathname, to));
      const item = itemRefs.current[index];
      if (!item) {
        setIndicator((prev) => ({ ...prev, opacity: 0 }));
        return;
      }
      setIndicator({ left: item.offsetLeft, width: item.offsetWidth, opacity: 1 });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pathname]);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="site-logo">
          <img src={logoUrl} alt="Fashley logo" width={48} height={48} />
          <span>Fashley</span>
        </Link>
        <nav ref={navRef} aria-label="Main navigation" className="tubelight">
          <span
            className="tube-indicator"
            aria-hidden="true"
            style={{ left: indicator.left, width: indicator.width, opacity: indicator.opacity }}
          />
          {links.map(([label, to], index) => (
            <span
              key={to}
              className="tube-item"
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
            >
              <Link
                to={to}
                className="tube-link"
                data-active={isActive(pathname, to)}
                aria-current={isActive(pathname, to) ? "page" : undefined}
              >
                {label}
              </Link>
            </span>
          ))}
        </nav>
        <div className="site-actions">
          <CartDrawer />
          <AuthLink />
        </div>
        <div className="site-mobile-actions">
          <CartDrawer />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Open menu">
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full max-w-sm">
              <SheetTitle>Fashley</SheetTitle>
              <SheetDescription>Fashley menu</SheetDescription>
              <nav aria-label="Mobile navigation" className="mt-8 flex flex-col gap-3">
                {links.map(([label, to]) => (
                  <SheetClose asChild key={to}>
                    <Button asChild variant="ghost" className="justify-start">
                      <Link to={to} aria-current={isActive(pathname, to) ? "page" : undefined}>
                        {label}
                      </Link>
                    </Button>
                  </SheetClose>
                ))}
                <AuthLink mobile />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
