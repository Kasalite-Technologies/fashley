import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { OrganizerShell } from "@/components/events/OrganizerShell";
import { SignedOutPanel, useEventsAuth } from "@/components/events/EventsAuth";
import { eventsApi, EventApiError } from "@/lib/events/client/api";
import { formatEventDate, LIFECYCLE_LABELS, type OwnRegistration } from "@/lib/events/contracts";

export const Route = createFileRoute("/events/mine/")({
  head: () => ({
    meta: [
      { title: "My events | Fashley" },
      { name: "description", content: "Tickets and event registrations on your Fashley account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyEventsPage,
});

function MyEventsPage() {
  const auth = useEventsAuth();
  return (
    <OrganizerShell
      title="My events"
      description="Tickets, waitlist places and access details for everything you registered for."
      actions={
        <a href="/events" className="ev-button" data-variant="quiet">
          Browse events
        </a>
      }
    >
      {!auth.isLoaded ? (
        <p role="status">Checking your session…</p>
      ) : !auth.isSignedIn ? (
        <SignedOutPanel
          title="Sign in to see your tickets"
          description="Registrations are tied to the account that booked them."
          redirectTo="/events"
        />
      ) : (
        <MyEventsList />
      )}
    </OrganizerShell>
  );
}

function MyEventsList() {
  const query = useQuery({
    queryKey: ["my-registrations"],
    queryFn: () => eventsApi.myRegistrations(),
  });

  if (query.isPending) return <p role="status">Loading your registrations…</p>;
  if (query.isError)
    return (
      <div className="ev-panel">
        <h2>Your registrations could not load</h2>
        <button className="ev-button mt-5" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );

  const upcoming = query.data.items.filter(
    (item) => new Date(item.eventEndsAt).getTime() >= Date.now() || item.checkedInAt,
  );
  const past = query.data.items.filter((item) => !upcoming.includes(item));

  if (query.data.items.length === 0) {
    return (
      <div className="ev-panel">
        <h2>No registrations yet</h2>
        <p>Find an event and register. Tickets appear here straight after you confirm.</p>
        <a className="ev-button mt-5" data-variant="accent" href="/events">
          Browse events
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-10">
      <section>
        <h2 className="text-2xl">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing coming up.</p>
        ) : (
          <div className="ev-list mt-4">
            {upcoming.map((item) => (
              <RegistrationCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
      {past.length > 0 ? (
        <section>
          <h2 className="text-2xl">Past and cancelled</h2>
          <div className="ev-list mt-4">
            {past.map((item) => (
              <RegistrationCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function RegistrationCard({ item }: { item: OwnRegistration }) {
  const [ticket, setTicket] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function revealTicket() {
    setBusy(true);
    try {
      const data = await eventsApi.ticket(item.id);
      setTicket(data.credential);
    } catch (e) {
      toast.error(e instanceof EventApiError ? e.failure.message : "Ticket could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm("Cancel this registration? Your ticket stops working.")) return;
    setBusy(true);
    try {
      await eventsApi.cancelRegistration(item.id);
      toast.success("Registration cancelled");
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof EventApiError ? e.failure.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  const stateLabel =
    item.state === "confirmed"
      ? "Confirmed"
      : item.state === "waitlisted"
        ? "Waitlisted"
        : "Cancelled";

  return (
    <article className="ev-list-row">
      <div>
        <p className="ev-card-date">
          {formatEventDate(item.eventStartsAt, item.eventEndsAt, item.eventTimezone)}
        </p>
        <h3 className="ev-card-title">
          {item.eventPublication === "published" ? (
            <Link to="/events/$slug" params={{ slug: item.eventSlug }}>
              {item.eventTitle}
            </Link>
          ) : (
            item.eventTitle
          )}
        </h3>
        <p className="ev-card-meta">
          {item.eventFormat === "online" ? "Online" : (item.eventCity ?? "Venue to be confirmed")} ·{" "}
          {LIFECYCLE_LABELS[item.eventLifecycle]}
        </p>
        <div className="ev-tags">
          <span className="ev-tag" data-tone={item.state === "confirmed" ? "open" : undefined}>
            {stateLabel}
          </span>
          {item.checkedInAt ? <span className="ev-tag">Checked in</span> : null}
        </div>
        {item.eventLifecycle === "cancelled" ? (
          <p className="ev-notice">The organiser cancelled this event.</p>
        ) : null}
        {item.eventLifecycle === "postponed" ? (
          <p className="ev-notice">
            This event was postponed. Watch the event page for a new date.
          </p>
        ) : null}
        {item.accessInfo ? (
          <p className="mt-3 text-sm">
            <strong>Access notes:</strong> {item.accessInfo}
          </p>
        ) : null}
        {item.onlineUrl ? (
          <p className="mt-2 text-sm">
            <a className="ev-link" href={item.onlineUrl} target="_blank" rel="noopener noreferrer">
              Join the event online
            </a>
          </p>
        ) : null}
        {ticket ? (
          <>
            <p className="ev-label mt-4">Ticket code</p>
            <p className="ev-ticket-code">{ticket}</p>
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {item.state === "confirmed" && !ticket ? (
          <button className="ev-button" disabled={busy} onClick={() => void revealTicket()}>
            {busy ? "Loading…" : "Show ticket"}
          </button>
        ) : null}
        {item.state !== "cancelled" ? (
          <button
            className="ev-button"
            data-variant="quiet"
            disabled={busy}
            onClick={() => void cancel()}
          >
            Cancel place
          </button>
        ) : null}
      </div>
    </article>
  );
}
