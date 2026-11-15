import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EventEditor } from "@/components/events/EventEditor";
import { OrganizerShell } from "@/components/events/OrganizerShell";
import { SignedOutPanel, useEventsAuth } from "@/components/events/EventsAuth";
import { eventsApi } from "@/lib/events/client/api";

export const Route = createFileRoute("/events/submit")({
  head: () => ({
    meta: [
      { title: "Submit an event | Fashley" },
      {
        name: "description",
        content:
          "Add a fashion show, market, workshop or talk to the Fashley events directory. Every listing is reviewed before publication.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SubmitEventPage,
});

function SubmitEventPage() {
  const auth = useEventsAuth();
  return (
    <OrganizerShell
      title="Submit an event"
      description="Describe the event once. Fashley reviews it, then it appears in the directory with registration handled here."
      actions={
        <Link to="/organizer/events" className="ev-button" data-variant="quiet">
          Organiser dashboard
        </Link>
      }
    >
      {!auth.isLoaded ? (
        <p role="status">Checking your session…</p>
      ) : !auth.isSignedIn ? (
        <SignedOutPanel
          title="Sign in to submit an event"
          description="You need a Fashley account so attendees can be managed against a real organiser. Email verification is required."
          redirectTo="/events"
        />
      ) : (
        <SubmitInner />
      )}
    </OrganizerShell>
  );
}

function SubmitInner() {
  const profile = useQuery({
    queryKey: ["my-organizer"],
    queryFn: () => eventsApi.myOrganizer(),
  });

  if (profile.isPending) return <p role="status">Loading your organiser profile…</p>;
  if (profile.isError)
    return (
      <div className="ev-panel">
        <h2>We could not load your organiser profile</h2>
        <button className="ev-button mt-5" onClick={() => void profile.refetch()}>
          Try again
        </button>
      </div>
    );

  return <EventEditor />;
}
