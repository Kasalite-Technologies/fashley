import { Link, createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { AvailabilityTag } from "@/components/events/AvailabilityTag";
import { useEventsAuth } from "@/components/events/EventsAuth";
import { loadEvent } from "@/lib/events/server-fns";
import { eventsApi, EventApiError } from "@/lib/events/client/api";
import {
  CATEGORY_LABELS,
  FORMAT_LABELS,
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  formatEventDate,
  type EventDetail,
} from "@/lib/events/contracts";
import "@/styles/events.css";

export const Route = createFileRoute("/events/$slug/")({
  loader: async ({ params }) => {
    const event = await loadEvent({ data: { slug: params.slug } });
    if (!event) throw notFound();
    return event;
  },
  head: ({ loaderData }) => {
    const event = loaderData as EventDetail | undefined;
    if (!event) return { meta: [{ title: "Event | Fashley" }] };
    const description = event.summary || event.description.slice(0, 160);
    return {
      meta: [
        { title: `${event.title} | Fashley events` },
        { name: "description", content: description },
        { property: "og:title", content: event.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        ...(event.coverUrl ? [{ property: "og:image", content: event.coverUrl }] : []),
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: EventLoadError,
  notFoundComponent: () => (
    <div className="events-page">
      <SiteHeader />
      <main className="ev-shell">
        <h1 className="text-4xl">This event is not listed</h1>
        <p className="mt-3 text-muted-foreground">
          It may have been removed, or the link is wrong.
        </p>
        <a className="ev-button mt-6" href="/events">
          Browse events
        </a>
      </main>
    </div>
  ),
  component: EventPage,
});

const eventQuery = (slug: string) =>
  queryOptions({
    queryKey: ["event", slug],
    queryFn: () => loadEvent({ data: { slug } }),
  });

function EventLoadError({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <div className="events-page">
      <SiteHeader />
      <main className="ev-shell">
        <h1 className="text-4xl">This event could not load</h1>
        <Button
          className="mt-6"
          onClick={() => {
            void router.invalidate();
            reset();
          }}
        >
          Try again
        </Button>
      </main>
    </div>
  );
}

function EventPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(eventQuery(slug));
  if (!data) return null;
  return <EventDetailView event={data} />;
}

function EventDetailView({ event }: { event: EventDetail }) {
  const auth = useEventsAuth();
  const [formOpen, setFormOpen] = useState<"register" | "waitlist" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<null | { waitlisted: boolean }>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const closed =
    event.availability === "closed" ||
    event.availability === "not_open" ||
    event.availability === "ended" ||
    event.availability === "cancelled" ||
    event.availability === "postponed";

  async function submitRegistration(values: {
    displayName: string;
    email: string;
    phone: string;
    accessibilityRequest: string;
  }) {
    setBusy(true);
    setError("");
    try {
      if (formOpen === "waitlist") {
        await eventsApi.joinWaitlist(event.slug, values);
        setDone({ waitlisted: true });
      } else {
        await eventsApi.register(event.slug, values);
        setDone({ waitlisted: false });
      }
      setFormOpen(null);
      toast.success(
        formOpen === "waitlist" ? "You joined the waitlist" : "Your place is confirmed",
      );
    } catch (e) {
      setError(e instanceof EventApiError ? e.failure.message : "Registration failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="events-page">
      <SiteHeader />
      <main className="ev-shell">
        <BackButton fallback="/events" label="All events" className="mb-6" />
        <div className="ev-detail">
          <div>
            {event.coverUrl ? (
              <img className="ev-cover" src={event.coverUrl} alt="" width={1200} height={750} />
            ) : null}
            <div className="ev-tags mt-5">
              <span className="ev-tag">{CATEGORY_LABELS[event.category]}</span>
              <span className="ev-tag">{FORMAT_LABELS[event.format]}</span>
              <AvailabilityTag availability={event.availability} />
            </div>
            <h1>{event.title}</h1>
            {event.summary ? <p className="ev-card-meta mt-2">{event.summary}</p> : null}

            <dl className="ev-facts">
              <div className="ev-fact">
                <dt>Date</dt>
                <dd>{formatEventDate(event.startsAt, event.endsAt, event.timezone)}</dd>
              </div>
              <div className="ev-fact">
                <dt>Time zone</dt>
                <dd>{event.timezone}</dd>
              </div>
              <div className="ev-fact">
                <dt>Location</dt>
                <dd>
                  {event.format === "online"
                    ? "Online"
                    : [event.venue, event.city, event.country].filter(Boolean).join(", ") ||
                      "To be confirmed"}
                  {event.format === "hybrid" ? " and online" : ""}
                </dd>
              </div>
              <div className="ev-fact">
                <dt>Organiser</dt>
                <dd>
                  <Link
                    className="ev-link"
                    to="/organizers/$slug"
                    params={{ slug: event.organizerSlug }}
                  >
                    {event.organizerName}
                  </Link>
                </dd>
              </div>
              {event.ageLimit !== null ? (
                <div className="ev-fact">
                  <dt>Age limit</dt>
                  <dd>{event.ageLimit === 0 ? "All ages" : `${event.ageLimit} and over`}</dd>
                </div>
              ) : null}
              {event.accessibility ? (
                <div className="ev-fact">
                  <dt>Accessibility</dt>
                  <dd>{event.accessibility}</dd>
                </div>
              ) : null}
            </dl>

            {event.lifecycle === "cancelled" ? (
              <p className="ev-notice">
                This event was cancelled. Existing registrations are no longer valid for entry.
              </p>
            ) : null}
            {event.lifecycle === "postponed" ? (
              <p className="ev-notice">
                This event was postponed. Registration stays paused until a new date is published.
              </p>
            ) : null}

            <div className="ev-prose">{event.description}</div>

            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm">
              <a
                className="ev-link"
                href={`data:text/calendar;charset=utf-8,${encodeURIComponent(calendarFile(event))}`}
                download={`${event.slug}.ics`}
              >
                Add to calendar
              </a>
              <button className="ev-link" type="button" onClick={() => setReportOpen((v) => !v)}>
                Report this listing
              </button>
            </div>

            {reportOpen ? (
              <ReportForm slug={event.slug} onDone={() => setReportOpen(false)} />
            ) : null}
          </div>

          <aside className="ev-side" aria-labelledby="registration-heading">
            <h2 id="registration-heading">Registration</h2>
            <p className="ev-side-status">
              {event.capacity !== null
                ? `${event.remaining ?? 0} of ${event.capacity} places left`
                : "No set capacity"}
              {event.waitlistEnabled ? " · waitlist available" : ""}
            </p>

            {done ? (
              <div className="ev-panel" style={{ marginTop: 18 }}>
                <h2>{done.waitlisted ? "You are on the waitlist" : "You are registered"}</h2>
                <p>
                  {done.waitlisted
                    ? "The organiser confirms waitlisted places manually. This is not a confirmed seat yet."
                    : "Your ticket is in My events, with the access details for this event."}
                </p>
                <Link className="ev-button mt-5" to="/events/mine">
                  Open My events
                </Link>
              </div>
            ) : formOpen ? (
              <RegistrationForm
                mode={formOpen}
                busy={busy}
                error={error}
                onCancel={() => setFormOpen(null)}
                onSubmit={submitRegistration}
              />
            ) : (
              <div className="ev-side-actions">
                {event.availability === "open" ? (
                  <button
                    className="ev-button"
                    data-variant="accent"
                    onClick={() => {
                      if (!auth.configured || !auth.isSignedIn) {
                        window.location.assign(`/sign-in?redirectTo=/events&mode=in`);
                        return;
                      }
                      setFormOpen("register");
                    }}
                  >
                    Register for this event
                  </button>
                ) : null}
                {event.availability === "waitlist" ? (
                  <button
                    className="ev-button"
                    data-variant="accent"
                    onClick={() => {
                      if (!auth.configured || !auth.isSignedIn) {
                        window.location.assign(`/sign-in?redirectTo=/events&mode=in`);
                        return;
                      }
                      setFormOpen("waitlist");
                    }}
                  >
                    Join the waitlist
                  </button>
                ) : null}
                {closed ? (
                  <p className="ev-side-status">
                    {event.availability === "ended"
                      ? "This event has ended."
                      : event.availability === "not_open"
                        ? "Registration has not opened yet."
                        : "Registration is closed."}
                  </p>
                ) : null}
                {event.availability === "full" ? (
                  <p className="ev-side-status">This event is full and has no waitlist.</p>
                ) : null}
                {event.availability === "open" && !auth.isSignedIn ? (
                  <p className="ev-side-status">You will sign in before confirming.</p>
                ) : null}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function RegistrationForm({
  mode,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  mode: "register" | "waitlist";
  busy: boolean;
  error: string;
  onSubmit: (values: {
    displayName: string;
    email: string;
    phone: string;
    accessibilityRequest: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <form
      className="ev-form"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        void onSubmit({
          displayName: String(form.get("displayName") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          accessibilityRequest: String(form.get("accessibilityRequest") ?? ""),
        });
      }}
    >
      <label className="ev-field">
        <span>Name</span>
        <input name="displayName" required minLength={2} maxLength={120} autoComplete="name" />
      </label>
      <label className="ev-field">
        <span>Email</span>
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label className="ev-field">
        <span>Phone (optional)</span>
        <input name="phone" autoComplete="tel" maxLength={40} />
      </label>
      <label className="ev-field">
        <span>Accessibility needs (optional)</span>
        <textarea name="accessibilityRequest" className="ev-textarea" maxLength={500} rows={3} />
      </label>
      {mode === "waitlist" ? (
        <p className="ev-side-status">
          The waitlist does not reserve a seat. The organiser confirms places manually.
        </p>
      ) : null}
      {error ? <p className="ev-error">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="ev-button" data-variant="accent" disabled={busy}>
          {busy ? "Sending…" : mode === "waitlist" ? "Join waitlist" : "Confirm registration"}
        </Button>
        <Button type="button" className="ev-button" data-variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ReportForm({ slug, onDone }: { slug: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      className="ev-form ev-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setMessage("");
        try {
          await eventsApi.report(slug, {
            reason: String(form.get("reason") ?? "other"),
            detail: String(form.get("detail") ?? ""),
            reporterEmail: String(form.get("reporterEmail") ?? ""),
          });
          setMessage("Thank you. An editor will review this listing.");
          onDone();
        } catch (error) {
          setMessage(
            error instanceof EventApiError
              ? error.failure.message
              : "The report could not be sent.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Report this listing</h2>
      <label className="ev-field">
        <span>Reason</span>
        <select name="reason" defaultValue="wrong_details">
          {REPORT_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {REPORT_REASON_LABELS[reason]}
            </option>
          ))}
        </select>
      </label>
      <label className="ev-field">
        <span>What is wrong?</span>
        <textarea name="detail" className="ev-textarea" maxLength={1000} rows={3} />
      </label>
      <label className="ev-field">
        <span>Your email (optional)</span>
        <input name="reporterEmail" type="email" />
      </label>
      {message ? <p className="ev-success">{message}</p> : null}
      <Button type="submit" className="ev-button" data-variant="quiet" disabled={busy}>
        {busy ? "Sending…" : "Send report"}
      </Button>
    </form>
  );
}

function calendarFile(event: EventDetail) {
  const stamp = (iso: string) => `${iso.replace(/[-:]/g, "").split(".")[0]}Z`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fashley//Events//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@fashley.app`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `DTEND:${stamp(event.endsAt)}`,
    `SUMMARY:${event.title.replace(/\n/g, " ")}`,
    `DESCRIPTION:${(event.summary || event.description).replace(/\n/g, " ").slice(0, 400)}`,
    `LOCATION:${[event.venue, event.city, event.country].filter(Boolean).join(", ") || "Online"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}
