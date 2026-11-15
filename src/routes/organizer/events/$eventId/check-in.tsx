import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { OrganizerShell } from "@/components/events/OrganizerShell";
import { SignedOutPanel, useEventsAuth } from "@/components/events/EventsAuth";
import { eventsApi, EventApiError } from "@/lib/events/client/api";
import { ReviewCheckIn } from "@/components/events/CheckIn";
import { CATEGORY_LABELS } from "@/lib/events/contracts";

export const Route = createFileRoute("/organizer/events/$eventId/check-in")({
  head: () => ({
    meta: [{ title: "Manage attendees | Fashley" }, { name: "robots", content: "noindex" }],
  }),
  component: ManageEventPage,
});

function ManageEventPage() {
  const { eventId } = Route.useParams();
  const auth = useEventsAuth();
  return (
    <OrganizerShell
      title="Manage event"
      description="Confirm waitlisted people, check tickets at the door, and close registration."
      actions={
        <Link
          className="ev-button"
          data-variant="quiet"
          to="/organizer/events/$eventId"
          params={{ eventId }}
        >
          Edit listing
        </Link>
      }
    >
      {!auth.isLoaded ? (
        <p role="status">Checking your session…</p>
      ) : !auth.isSignedIn ? (
        <SignedOutPanel
          title="Sign in to manage this event"
          description="Attendee details are only available to the organiser."
          redirectTo="/events"
        />
      ) : (
        <ManageInner eventId={eventId} />
      )}
    </OrganizerShell>
  );
}

function ManageInner({ eventId }: { eventId: string }) {
  const event = useQuery({
    queryKey: ["organizer-event", eventId],
    queryFn: () => eventsApi.myEvent(eventId),
  });
  const attendees = useQuery({
    queryKey: ["organizer-attendees", eventId],
    queryFn: () => eventsApi.attendees(eventId),
  });
  const [busyId, setBusyId] = useState("");

  if (event.isPending || attendees.isPending) return <p role="status">Loading attendees…</p>;
  if (event.isError || attendees.isError || !event.data)
    return (
      <div className="ev-panel">
        <h2>This event could not load</h2>
        <button
          className="ev-button mt-5"
          onClick={() => {
            void event.refetch();
            void attendees.refetch();
          }}
        >
          Try again
        </button>
      </div>
    );

  const confirmed = attendees.data.items.filter((a) => a.state === "confirmed");
  const waitlisted = attendees.data.items.filter((a) => a.state === "waitlisted");

  async function promote(id: string) {
    setBusyId(id);
    try {
      await eventsApi.promote(eventId, id);
      toast.success("Place confirmed and ticket issued");
      await attendees.refetch();
    } catch (e) {
      toast.error(
        e instanceof EventApiError ? e.failure.message : "That person could not be promoted.",
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="grid gap-8">
      <section className="ev-panel" style={{ marginTop: 0 }}>
        <h2>{event.data.title}</h2>
        <p>
          {CATEGORY_LABELS[event.data.category]} · {event.data.city || "Online"} ·{" "}
          {event.data.publication === "published" ? "Listed in the directory" : "Not listed"}
        </p>
        <div className="ev-tags mt-4">
          <span className="ev-tag">{confirmed.length} confirmed</span>
          <span className="ev-tag">{waitlisted.length} waiting</span>
          <span className="ev-tag">{confirmed.filter((a) => a.checkedInAt).length} checked in</span>
          {event.data.capacity ? (
            <span className="ev-tag">{event.data.capacity} total places</span>
          ) : null}
          <span className="ev-tag">
            {event.data.registrationClosed ? "Registration closed" : "Registration open"}
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            className="ev-button"
            data-variant="quiet"
            disabled={busyId === "registration"}
            onClick={async () => {
              setBusyId("registration");
              try {
                await eventsApi.setRegistrationClosed(eventId, !event.data.registrationClosed);
                toast.success(
                  event.data.registrationClosed ? "Registration reopened" : "Registration closed",
                );
                await event.refetch();
              } catch (e) {
                toast.error(e instanceof EventApiError ? e.failure.message : "That change failed.");
              } finally {
                setBusyId("");
              }
            }}
          >
            {event.data.registrationClosed ? "Reopen registration" : "Close registration"}
          </button>
          {event.data.publication === "published" ? (
            <Link
              className="ev-button"
              data-variant="quiet"
              to="/events/$slug"
              params={{ slug: event.data.slug }}
            >
              View public page
            </Link>
          ) : null}
        </div>
      </section>

      <ReviewCheckIn eventId={eventId} />

      <section>
        <h2 className="text-2xl">Waitlist</h2>
        {waitlisted.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nobody is waiting.</p>
        ) : (
          <div className="ev-list mt-4">
            {waitlisted.map((person) => (
              <div key={person.id} className="ev-list-row">
                <div>
                  <p className="ev-card-title">{person.displayName}</p>
                  <p className="ev-card-meta">{person.email}</p>
                </div>
                <button
                  className="ev-button"
                  data-variant="accent"
                  disabled={busyId === person.id}
                  onClick={() => void promote(person.id)}
                >
                  {busyId === person.id ? "Confirming…" : "Confirm place"}
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Confirming a place takes the next available seat and emails a ticket. It never overbooks.
        </p>
      </section>

      <section>
        <h2 className="text-2xl">Confirmed attendees</h2>
        {confirmed.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No confirmed registrations yet.</p>
        ) : (
          <div className="ev-table-wrap mt-4">
            <table className="ev-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Checked in</th>
                </tr>
              </thead>
              <tbody>
                {confirmed.map((person) => (
                  <tr key={person.id}>
                    <td>{person.displayName}</td>
                    <td>{person.email}</td>
                    <td>{person.phone || "Not given"}</td>
                    <td>
                      {person.checkedInAt
                        ? new Date(person.checkedInAt).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Not yet"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Attendee contact details are private to this event. Do not share or export them without a
          lawful reason.
        </p>
      </section>
    </div>
  );
}
