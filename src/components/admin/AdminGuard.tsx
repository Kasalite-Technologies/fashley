import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminFrame } from "@/components/admin/AdminFrame";
import { SignedOutPanel, useEventsAuth } from "@/components/events/EventsAuth";
import { eventsApi } from "@/lib/events/client/api";
import { Button } from "@/components/ui/button";

/**
 * Every admin page is gated the same way: the session endpoint decides whether
 * this account has an active staff grant. Hiding links is not authorization —
 * the API rejects unauthorized requests independently.
 */
export function AdminGuard({
  children,
}: {
  children: (role: "events_editor" | "platform_admin") => React.ReactNode;
}) {
  const auth = useEventsAuth();
  const [retry, setRetry] = useState(0);

  const session = useQuery({
    queryKey: ["admin-session", retry],
    queryFn: () => eventsApi.adminSession(),
    retry: false,
    enabled: auth.configured && auth.isSignedIn,
  });

  if (!auth.configured)
    return (
      <div className="admin-root">
        <main className="admin-page">
          <h1>Admin is not configured</h1>
          <p className="admin-page-sub">Sign-in is not configured on this deployment.</p>
        </main>
      </div>
    );

  if (!auth.isLoaded)
    return (
      <div className="admin-root">
        <main className="admin-page" role="status">
          Checking your session…
        </main>
      </div>
    );

  if (!auth.isSignedIn)
    return (
      <div className="admin-root">
        <main className="admin-page">
          <SignedOutPanel
            title="Sign in to open the admin"
            description="Fashley events staff sign in with the account that holds an active staff grant."
            redirectTo="/events"
          />
        </main>
      </div>
    );

  if (session.isPending)
    return (
      <div className="admin-root">
        <main className="admin-page" role="status">
          Checking staff access…
        </main>
      </div>
    );

  if (session.isError || !session.data.role) {
    return (
      <div className="admin-root">
        <main className="admin-page">
          <h1>You do not have admin access</h1>
          <p className="admin-page-sub">
            This area is limited to Fashley event staff. If that should be you, ask a platform admin
            to grant access to your verified account.
          </p>
          <div className="mt-6 flex gap-2">
            <Button asChild className="admin-button">
              <a href="/events">Back to events</a>
            </Button>
            <button className="admin-button" onClick={() => setRetry((n) => n + 1)}>
              Check again
            </button>
          </div>
        </main>
      </div>
    );
  }

  return <>{children(session.data.role)}</>;
}

export { AdminFrame };
