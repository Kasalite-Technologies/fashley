import { createFileRoute } from "@tanstack/react-router";
import { EventEditor } from "@/components/events/EventEditor";
import { OrganizerShell } from "@/components/events/OrganizerShell";
import { SignedOutPanel, useEventsAuth } from "@/components/events/EventsAuth";

export const Route = createFileRoute("/organizer/events/$eventId/")({
  head: () => ({
    meta: [{ title: "Edit event | Fashley" }, { name: "robots", content: "noindex" }],
  }),
  component: EditEventPage,
});

function EditEventPage() {
  const { eventId } = Route.useParams();
  const auth = useEventsAuth();
  return (
    <OrganizerShell
      title="Edit event"
      description="Changes to a published listing are reviewed before they go live."
    >
      {!auth.isLoaded ? (
        <p role="status">Checking your session…</p>
      ) : !auth.isSignedIn ? (
        <SignedOutPanel
          title="Sign in to edit this event"
          description="Only the organiser who submitted an event can edit it."
          redirectTo="/events"
        />
      ) : (
        <EventEditor eventId={eventId} />
      )}
    </OrganizerShell>
  );
}
