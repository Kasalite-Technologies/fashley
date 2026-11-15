import { createFileRoute } from "@tanstack/react-router";
import { EventEditor } from "@/components/events/EventEditor";
import { OrganizerShell } from "@/components/events/OrganizerShell";
import { SignedOutPanel, useEventsAuth } from "@/components/events/EventsAuth";

export const Route = createFileRoute("/organizer/events/new")({
  head: () => ({
    meta: [{ title: "New event | Fashley" }, { name: "robots", content: "noindex" }],
  }),
  component: NewEventPage,
});

function NewEventPage() {
  const auth = useEventsAuth();
  return (
    <OrganizerShell
      title="New event"
      description="Save a draft, add the details, then submit it for review."
    >
      {!auth.isLoaded ? (
        <p role="status">Checking your session…</p>
      ) : !auth.isSignedIn ? (
        <SignedOutPanel
          title="Sign in to create an event"
          description="Events are tied to a verified organiser account."
          redirectTo="/events"
        />
      ) : (
        <EventEditor />
      )}
    </OrganizerShell>
  );
}
