import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useAuth as useClerkAuth } from "@clerk/tanstack-react-start";
import { setEventTokenProvider } from "@/lib/events/client/api";
import type { AuthRedirect } from "@/components/CustomAuth";
import { clerkConfigured } from "@/components/tailor/TailorClerk";
import { Button } from "@/components/ui/button";

/**
 * Events use the same Clerk session as the studio. The bridge installs a token
 * getter for `eventsApi`; without a publishable key the pages render a plain
 * "sign in" state instead of calling Clerk hooks that were never mounted.
 */
function EventsAuthBridge() {
  const { getToken, isLoaded, userId } = useClerkAuth();
  const queryClient = useQueryClient();
  const previousUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    setEventTokenProvider(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
    return () => setEventTokenProvider(null);
  }, [getToken]);
  useEffect(() => {
    if (!isLoaded || previousUser.current === userId) return;
    previousUser.current = userId;
    void queryClient.resetQueries({
      predicate: ({ queryKey }) =>
        typeof queryKey[0] === "string" && /^(admin-|organizer-|my-)/.test(queryKey[0]),
    });
  }, [isLoaded, userId, queryClient]);
  return null;
}

export function EventsAuthProvider({ children }: { children: ReactNode }) {
  if (!clerkConfigured) return <>{children}</>;
  return (
    <>
      <EventsAuthBridge />
      {children}
    </>
  );
}

// Clerk's hook throws without a provider, so the no-op branch is chosen once
// at module load. A conditional call inside the hook would break hook order.
const useNoopAuth = () => ({ isLoaded: true, isSignedIn: false });
const useSessionAuth = clerkConfigured ? useClerkAuth : useNoopAuth;

export function useEventsAuth() {
  const { isLoaded, isSignedIn } = useSessionAuth();
  return {
    configured: clerkConfigured,
    isLoaded: clerkConfigured ? isLoaded : true,
    isSignedIn: Boolean(isSignedIn),
  };
}

export function SignedOutPanel({
  title,
  description,
  redirectTo,
}: {
  title: string;
  description: string;
  redirectTo: AuthRedirect;
}) {
  const auth = useEventsAuth();
  if (!auth.configured) {
    return (
      <div className="events-panel">
        <h2>{title}</h2>
        <p>Sign-in is not configured on this deployment yet.</p>
      </div>
    );
  }
  if (!auth.isLoaded) {
    return (
      <div className="events-panel" role="status">
        <p>Checking your session…</p>
      </div>
    );
  }
  return (
    <div className="events-panel">
      <h2>{title}</h2>
      <p>{description}</p>
      <Button asChild className="mt-5">
        <Link to="/sign-in" search={{ redirectTo, mode: "in" }}>
          Sign in
        </Link>
      </Button>
    </div>
  );
}
