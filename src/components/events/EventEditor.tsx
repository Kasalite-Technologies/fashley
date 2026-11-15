import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { eventsApi, EventApiError } from "@/lib/events/client/api";
import { draftToInput, blankDraft, type OrganizerSummary } from "@/lib/events/client/draft";
import {
  CATEGORY_LABELS,
  EVENT_CATEGORIES,
  EVENT_FORMATS,
  FORMAT_LABELS,
  REVIEW_LABELS,
  type DraftEventInput,
  type EventEditorDraft,
} from "@/lib/events/contracts";

const ESSENTIAL_FIELDS: Array<keyof DraftEventInput> = [
  "title",
  "startsAt",
  "endsAt",
  "timezone",
  "category",
  "format",
];

export function EventEditor({ eventId }: { eventId?: string }) {
  const navigate = useNavigate();
  const [organizer, setOrganizer] = useState<OrganizerSummary | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [draft, setDraft] = useState<EventEditorDraft | null>(null);
  const [form, setForm] = useState<DraftEventInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);
  const [rights, setRights] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const profile = await eventsApi.myOrganizer();
      setOrganizer(profile);
      if (profile && eventId) {
        const loaded = await eventsApi.myEvent(eventId);
        setDraft(loaded);
        setForm(draftToInput(loaded));
      } else if (profile) {
        setForm(blankDraft(profile));
      }
    } catch (e) {
      setError(e instanceof EventApiError ? e.failure.message : "This event could not be loaded.");
    } finally {
      setProfileLoaded(true);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(update: Partial<DraftEventInput>) {
    setForm((prev) => (prev ? { ...prev, ...update } : prev));
    setSaved(false);
  }

  async function create() {
    if (!form) return;
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      const created = await eventsApi.createEvent(form);
      toast.success("Draft saved");
      void navigate({
        to: "/organizer/events/$eventId",
        params: { eventId: created.id },
      });
    } catch (e) {
      applyError(e);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!form || !eventId) return;
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      const updated = await eventsApi.saveEvent(eventId, form);
      setDraft(updated);
      setForm(draftToInput(updated));
      setSaved(true);
      toast.success("Draft saved");
    } catch (e) {
      applyError(e);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!form || !eventId) return;
    setBusy(true);
    setError("");
    try {
      if (!rights) {
        setError("Confirm that you have permission to publish this event and its images.");
        return;
      }
      await eventsApi.saveEvent(eventId, form);
      const updated = await eventsApi.submitEvent(eventId);
      setDraft(updated);
      toast.success("Submitted for review");
    } catch (e) {
      applyError(e);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!eventId) return;
    setBusy(true);
    try {
      const updated = await eventsApi.withdrawEvent(eventId);
      setDraft(updated);
      setForm(draftToInput(updated));
      toast.success("Withdrawn from review");
    } catch (e) {
      applyError(e);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File | null) {
    if (!file || !eventId) return;
    setBusy(true);
    try {
      const result = await eventsApi.uploadCover(eventId, file);
      setDraft((prev) => (prev ? { ...prev, coverUrl: result.coverUrl } : prev));
      toast.success("Cover updated");
    } catch (e) {
      applyError(e);
    } finally {
      setBusy(false);
    }
  }

  function applyError(e: unknown) {
    if (e instanceof EventApiError) {
      setError(e.failure.message);
      setFieldErrors(e.failure.fieldErrors ?? {});
    } else {
      setError("Something went wrong. Try again.");
    }
  }

  if (!profileLoaded) {
    return (
      <div className="ev-panel" role="status">
        <p>Loading your organiser details…</p>
      </div>
    );
  }

  if (!organizer) {
    return <OrganizerProfileForm onSaved={(profile) => setOrganizer(profile)} />;
  }

  if (!form) {
    return (
      <div className="ev-panel">
        <p>Preparing the event form…</p>
      </div>
    );
  }

  const editable = !draft || draft.canEdit;
  const field = (name: string) => fieldErrors[name]?.[0];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">{draft ? draft.title : "New event"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {draft
              ? `${REVIEW_LABELS[draft.reviewState]} · ${draft.publication === "published" ? "Listed in the directory" : "Not listed yet"}`
              : "Save a draft, then submit it for review."}
          </p>
        </div>
        {draft ? (
          <Link
            className="ev-button"
            data-variant="quiet"
            to="/organizer/events/$eventId"
            params={{ eventId: draft.id }}
          >
            Attendees and settings
          </Link>
        ) : null}
      </div>

      {draft?.organizerMessage ? (
        <p className="ev-notice">Editor note: {draft.organizerMessage}</p>
      ) : null}
      {draft && !editable ? (
        <p className="ev-notice">
          This event is in review. Withdraw it from review to make changes.
        </p>
      ) : null}

      <fieldset disabled={!editable || busy} className="mt-8" style={{ border: 0, padding: 0 }}>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="ev-field md:col-span-2">
            <span>Event title</span>
            <input
              value={form.title}
              maxLength={140}
              onChange={(e) => patch({ title: e.target.value })}
              aria-invalid={Boolean(field("title"))}
            />
            {field("title") ? <span className="ev-error">{field("title")}</span> : null}
          </label>
          <label className="ev-field md:col-span-2">
            <span>One-line summary</span>
            <input
              value={form.summary}
              maxLength={240}
              onChange={(e) => patch({ summary: e.target.value })}
            />
          </label>
          <label className="ev-field md:col-span-2">
            <span>Description</span>
            <textarea
              className="ev-textarea"
              value={form.description}
              maxLength={4000}
              rows={8}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </label>
          <label className="ev-field">
            <span>Category</span>
            <select
              value={form.category}
              onChange={(e) => patch({ category: e.target.value as DraftEventInput["category"] })}
            >
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="ev-field">
            <span>Attendance</span>
            <select
              value={form.format}
              onChange={(e) => patch({ format: e.target.value as DraftEventInput["format"] })}
            >
              {EVENT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABELS[f]}
                </option>
              ))}
            </select>
          </label>
          <label className="ev-field">
            <span>Starts</span>
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => patch({ startsAt: e.target.value })}
              aria-invalid={Boolean(field("startsAt"))}
            />
            {field("startsAt") ? <span className="ev-error">{field("startsAt")}</span> : null}
          </label>
          <label className="ev-field">
            <span>Ends</span>
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => patch({ endsAt: e.target.value })}
              aria-invalid={Boolean(field("endsAt"))}
            />
            {field("endsAt") ? <span className="ev-error">{field("endsAt")}</span> : null}
          </label>
          <label className="ev-field">
            <span>Time zone</span>
            <input
              value={form.timezone}
              maxLength={64}
              onChange={(e) => patch({ timezone: e.target.value })}
              placeholder="Africa/Accra"
              aria-invalid={Boolean(field("timezone"))}
            />
            {field("timezone") ? <span className="ev-error">{field("timezone")}</span> : null}
          </label>
          <label className="ev-field">
            <span>City</span>
            <input value={form.city} onChange={(e) => patch({ city: e.target.value })} />
          </label>
          <label className="ev-field">
            <span>Country</span>
            <input value={form.country} onChange={(e) => patch({ country: e.target.value })} />
          </label>
          <label className="ev-field">
            <span>Venue</span>
            <input
              value={form.venue}
              onChange={(e) => patch({ venue: e.target.value })}
              aria-invalid={Boolean(field("venue"))}
            />
            {field("venue") ? <span className="ev-error">{field("venue")}</span> : null}
          </label>
          <label className="ev-field">
            <span>Online joining link (private)</span>
            <input
              value={form.onlineUrl}
              onChange={(e) => patch({ onlineUrl: e.target.value })}
              placeholder="https://"
              aria-invalid={Boolean(field("onlineUrl"))}
            />
            {field("onlineUrl") ? <span className="ev-error">{field("onlineUrl")}</span> : null}
          </label>
          <label className="ev-field">
            <span>Registration opens (optional)</span>
            <input
              type="datetime-local"
              value={form.registrationOpensAt}
              onChange={(e) => patch({ registrationOpensAt: e.target.value })}
            />
          </label>
          <label className="ev-field">
            <span>Registration closes (optional)</span>
            <input
              type="datetime-local"
              value={form.registrationClosesAt}
              onChange={(e) => patch({ registrationClosesAt: e.target.value })}
              aria-invalid={Boolean(field("registrationClosesAt"))}
            />
            {field("registrationClosesAt") ? (
              <span className="ev-error">{field("registrationClosesAt")}</span>
            ) : null}
          </label>
          <label className="ev-field">
            <span>Capacity (leave empty for no limit)</span>
            <input
              value={form.capacity}
              inputMode="numeric"
              onChange={(e) => patch({ capacity: e.target.value })}
              aria-invalid={Boolean(field("capacity"))}
            />
            {field("capacity") ? <span className="ev-error">{field("capacity")}</span> : null}
          </label>
          <label className="ev-field">
            <span>Age limit (optional)</span>
            <input
              value={form.ageLimit}
              inputMode="numeric"
              onChange={(e) => patch({ ageLimit: e.target.value })}
            />
          </label>
          <label className="ev-field md:col-span-2">
            <span>Accessibility information</span>
            <textarea
              className="ev-textarea"
              value={form.accessibility}
              maxLength={800}
              rows={3}
              onChange={(e) => patch({ accessibility: e.target.value })}
            />
          </label>
          <label className="ev-field md:col-span-2">
            <span>Access notes for confirmed attendees (private)</span>
            <textarea
              className="ev-textarea"
              value={form.accessInfo}
              maxLength={1200}
              rows={3}
              onChange={(e) => patch({ accessInfo: e.target.value })}
            />
          </label>
          <label className="flex items-start gap-3 md:col-span-2">
            <input
              type="checkbox"
              checked={form.waitlistEnabled}
              onChange={(e) => patch({ waitlistEnabled: e.target.checked })}
              className="mt-1"
            />
            <span className="text-sm">
              Offer a waitlist when the event is full. Waitlisted people are not confirmed seats.
            </span>
          </label>
        </div>

        {eventId ? (
          <div className="mt-8">
            <p className="ev-label">Cover image</p>
            {draft?.coverUrl ? (
              <img
                src={draft.coverUrl}
                alt=""
                className="mt-3 w-full max-w-md rounded border border-border object-cover"
              />
            ) : null}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-3 text-sm"
              onChange={(e) => void upload(e.target.files?.[0] ?? null)}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              JPEG, PNG or WebP up to 6 MB. Covers stay private until an editor publishes the event.
            </p>
          </div>
        ) : null}
      </fieldset>

      {error ? <p className="ev-error">{error}</p> : null}
      {saved ? <p className="ev-success">Saved.</p> : null}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {eventId ? (
          <Button
            className="ev-button"
            data-variant="accent"
            onClick={() => void save()}
            disabled={busy || !editable}
          >
            {busy ? "Saving…" : "Save draft"}
          </Button>
        ) : (
          <Button
            className="ev-button"
            data-variant="accent"
            onClick={() => void create()}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save draft"}
          </Button>
        )}
        {eventId && draft?.reviewState === "submitted" ? (
          <Button
            className="ev-button"
            data-variant="quiet"
            onClick={() => void withdraw()}
            disabled={busy}
          >
            Withdraw from review
          </Button>
        ) : null}
        {eventId ? (
          <Button className="ev-button" onClick={() => void submit()} disabled={busy || !editable}>
            Submit for review
          </Button>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />I
          have permission to publish this event and its images.
        </label>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {ESSENTIAL_FIELDS.length > 0
          ? "Times use the event time zone. An editor reviews each listing before it appears."
          : null}
      </p>
    </div>
  );
}

function OrganizerProfileForm({ onSaved }: { onSaved: (profile: OrganizerSummary) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="ev-panel">
      <h2>Create your organiser profile</h2>
      <p>
        This is the public name and contact used for the events you submit. One profile per account.
      </p>
      <form
        className="ev-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            await eventsApi.saveOrganizer({
              name: String(data.get("name") ?? ""),
              bio: String(data.get("bio") ?? ""),
              city: String(data.get("city") ?? ""),
              country: String(data.get("country") ?? ""),
              website: String(data.get("website") ?? ""),
              contactEmail: String(data.get("contactEmail") ?? ""),
            });
            const profile = await eventsApi.myOrganizer();
            if (profile) onSaved(profile);
            toast.success("Organiser profile saved");
          } catch (err) {
            setError(
              err instanceof EventApiError
                ? err.failure.message
                : "The profile could not be saved.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="ev-field">
          <span>Organiser name</span>
          <input name="name" required maxLength={120} />
        </label>
        <label className="ev-field">
          <span>Public contact email</span>
          <input name="contactEmail" type="email" required maxLength={200} />
        </label>
        <label className="ev-field">
          <span>Short bio</span>
          <textarea name="bio" className="ev-textarea" maxLength={1200} rows={4} />
        </label>
        <div className="ev-form-row">
          <label className="ev-field">
            <span>City</span>
            <input name="city" maxLength={80} />
          </label>
          <label className="ev-field">
            <span>Country</span>
            <input name="country" maxLength={80} />
          </label>
        </div>
        <label className="ev-field">
          <span>Website (optional)</span>
          <input name="website" placeholder="https://" maxLength={500} />
        </label>
        {error ? <p className="ev-error">{error}</p> : null}
        <Button type="submit" className="ev-button" data-variant="accent" disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </div>
  );
}
