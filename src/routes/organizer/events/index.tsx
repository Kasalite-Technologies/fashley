import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { OrganizerShell } from "@/components/events/OrganizerShell";
import { SignedOutPanel, useEventsAuth } from "@/components/events/EventsAuth";
import { eventsApi } from "@/lib/events/client/api";
import {
  formatEventDate,
  LIFECYCLE_LABELS,
  PUBLICATION_LABELS,
  REVIEW_LABELS,
} from "@/lib/events/contracts";

export const Route = createFileRoute("/organizer/events/")({
  head: () => ({
    meta: [
      { title: "Organiser events | Fashley" },
      { name: "description", content: "Manage the events you submit to Fashley." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrganizerEventsPage,
});

function OrganizerEventsPage() {
  const auth = useEventsAuth();
  return (
    <OrganizerShell
      title="Your events"
      description="Drafts, submissions and published listings. Attendee details stay inside each event."
      actions={
        <Link to="/events/submit" className="ev-button" data-variant="accent">
          New event
        </Link>
      }
    >
      {!auth.isLoaded ? (
        <p role="status">Checking your session…</p>
      ) : !auth.isSignedIn ? (
        <SignedOutPanel
          title="Sign in to manage your events"
          description="Your organiser dashboard shows drafts, review notes and attendee counts."
          redirectTo="/events"
        />
      ) : (
        <OrganizerEventList />
      )}
    </OrganizerShell>
  );
}

function OrganizerEventList() {
  const query = useQuery({
    queryKey: ["organizer-events"],
    queryFn: () => eventsApi.myEvents(),
  });

  if (query.isPending) return <p role="status">Loading your events…</p>;
  if (query.isError)
    return (
      <div className="ev-panel">
        <h2>Your events could not load</h2>
        <button className="ev-button mt-5" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );

  if (!query.data.organizer) {
    return (
      <div className="ev-panel">
        <h2>No organiser profile yet</h2>
        <p>Create a listing to set up your public organiser name.</p>
        <Link className="ev-button mt-5" data-variant="accent" to="/events/submit">
          Start an event
        </Link>
      </div>
    );
  }

  if (query.data.items.length === 0) {
    return (
      <div className="ev-panel">
        <h2>No events yet</h2>
        <p>Submit your first event. An editor reviews it before it appears in the directory.</p>
        <Link className="ev-button mt-5" data-variant="accent" to="/events/submit">
          Submit an event
        </Link>
      </div>
    );
  }

  return (
    <div className="ev-list">
      {query.data.items.map((event) => (
        <article key={event.id} className="ev-list-row">
          <div>
            <h2 className="ev-card-title">
              <Link to="/organizer/events/$eventId" params={{ eventId: event.id }}>
                {event.title}
              </Link>
            </h2>
            <p className="ev-card-meta">
              {formatEventDate(event.startsAt, event.endsAt, event.timezone)} ·{" "}
              {event.city ?? "Online"}
            </p>
            <div className="ev-tags">
              <span className="ev-tag">{REVIEW_LABELS[event.reviewState]}</span>
              <span className="ev-tag">{PUBLICATION_LABELS[event.publication]}</span>
              <span className="ev-tag">{LIFECYCLE_LABELS[event.lifecycle]}</span>
              <span className="ev-tag">
                {event.confirmedCount}
                {event.capacity !== null ? ` / ${event.capacity}` : ""} confirmed
              </span>
              {event.waitlistedCount > 0 ? (
                <span className="ev-tag">{event.waitlistedCount} waiting</span>
              ) : null}
            </div>
            {event.organizerMessage ? (
              <p className="ev-notice">Editor note: {event.organizerMessage}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="ev-button"
              data-variant="quiet"
              to="/organizer/events/$eventId"
              params={{ eventId: event.id }}
            >
              Edit
            </Link>
            <Link
              className="ev-button"
              to="/organizer/events/$eventId/check-in"
              params={{ eventId: event.id }}
            >
              Manage
            </Link>
            {event.publication === "published" ? (
              <Link
                className="ev-button"
                data-variant="quiet"
                to="/events/$slug"
                params={{ slug: event.slug }}
              >
                View listing
              </Link>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
