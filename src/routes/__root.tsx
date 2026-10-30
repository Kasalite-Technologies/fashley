import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/logo.png.asset.json";
import { TailorClerkProvider } from "@/components/tailor/TailorClerk";
import { useCartSync } from "@/hooks/useCartSync";
import { registerPwa } from "@/lib/pwa-register";

const SPLASH: [number, number, number][] = [[1290,2796,3],[1179,2556,3],[1284,2778,3],[1170,2532,3],[1125,2436,3],[1242,2688,3],[828,1792,2],[750,1334,2],[640,1136,2],[2048,2732,2],[1668,2388,2],[1640,2360,2],[1536,2048,2]];

function NotFoundComponent() {
 return <div><SiteHeader/><main className="mx-auto max-w-lg px-5 py-16 text-center"><img src={logoAsset.url} alt="Fashley" width={100} height={100} className="mx-auto h-24 w-24 object-contain"/><p className="mt-6 text-sm text-muted-foreground">404 | Page not found</p><h1 className="mt-3 text-4xl">We can’t find this page.</h1><p className="mt-4 text-muted-foreground">This page may have moved. Head home or browse styles for your next outfit.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button asChild><Link to="/">Back home</Link></Button><Button asChild variant="outline"><Link to="/discover">Discover styles</Link></Button></div></main></div>;
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn’t load this page. Try again or head home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Fashley | Fabric design ideas" },
      { name: "description", content: "See outfit ideas from your fabric photo, with shoes and handbags in the same print." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#f7f1e8" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Fashley" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      ...SPLASH.map(([w, h, r]) => ({ rel: "apple-touch-startup-image", href: `/splash/splash-${w}x${h}.png`, media: `(device-width: ${w / r}px) and (device-height: ${h / r}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)` })),
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useCartSync();
  useEffect(() => registerPwa(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <TailorClerkProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <div className="flex min-h-dvh flex-col"><div className="flex-1"><Outlet /></div><SiteFooter /></div>
        <Toaster position="top-center" />
      </TailorClerkProvider>
    </QueryClientProvider>
  );
}
