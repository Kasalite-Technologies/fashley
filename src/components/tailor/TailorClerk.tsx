import { useEffect, type ReactNode } from "react";
import { ClerkProvider, SignIn, SignInButton, useAuth } from "@clerk/tanstack-react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { setTailorTokenProvider, tailorKeys } from "@/lib/tailor/client";

const publishableKey = import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"] || undefined;

export const clerkConfigured = publishableKey !== undefined;

/**
 * Bridges the Clerk session into the tailor HTTP adapter. On sign-in or
 * sign-out, tailor queries are invalidated so owner data reloads under the
 * new identity and never lingers from the previous one.
 */
function TailorAuthBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    setTailorTokenProvider(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
    return () => setTailorTokenProvider(null);
  }, [getToken]);

  useEffect(() => {
    if (isLoaded) void queryClient.invalidateQueries({ queryKey: tailorKeys.root });
  }, [isLoaded, isSignedIn, queryClient]);

  return null;
}

export function TailorClerkProvider({ children }: { children: ReactNode }) {
  if (!publishableKey) return <>{children}</>;
  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      <TailorAuthBridge />
      {children}
    </ClerkProvider>
  );
}

function ClerkSignInPanel({ redirectTo }: { redirectTo: string }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <p className="text-sm text-muted-foreground">Loading sign-in…</p>;
  if (isSignedIn) {
    return (
      <p className="text-sm text-muted-foreground">
        You are signed in. Try loading the page again.
      </p>
    );
  }
  return (
    <SignIn
      routing="hash"
      fallbackRedirectUrl={redirectTo}
      signUpFallbackRedirectUrl={redirectTo}
    />
  );
}

/**
 * Sign-in surface for owner pages. After sign-in the user returns to
 * `redirectTo` (the page they signed in from), never the site root.
 * Fails closed with an explanation when Clerk is not configured.
 */
/**
 * Sign-in as a modal over the current page (no embedded form on the page).
 * After sign-in the user returns to `redirectTo`. When Clerk is not
 * configured this falls back to the fail-closed notice.
 */
export function ClerkModalSignIn({
  redirectTo,
  label = "Sign in",
}: {
  redirectTo: string;
  label?: string;
}) {
  if (!publishableKey) return <TailorSignInPanel redirectTo={redirectTo} />;
  return (
    <SignInButton mode="modal" forceRedirectUrl={redirectTo} signUpForceRedirectUrl={redirectTo}>
      <Button size="lg">{label}</Button>
    </SignInButton>
  );
}

export function TailorSignInPanel({ redirectTo = "/tailor" }: { redirectTo?: string } = {}) {
  if (!publishableKey) {
    return (
      <Alert role="status">
        <AlertTitle>Sign-in is not configured</AlertTitle>
        <AlertDescription>
          <p>
            Tailor sign-in is unavailable in this deployment. No account data was loaded or changed.
          </p>
        </AlertDescription>
      </Alert>
    );
  }
  return <ClerkSignInPanel redirectTo={redirectTo} />;
}
