import type { Db } from "@/lib/tailor/server/db";
import { err } from "@/lib/tailor/server/errors";
import { nowMs } from "@/lib/tailor/server/util";
import type {
  EventCategory,
  EventFormat,
  LifecycleState,
  PublicationState,
  RegistrationAvailability,
  ReviewState,
} from "@/lib/events/contracts";

export interface EventRow {
  id: string;
  slug: string;
  organizer_id: string;
  organizer_name: string;
  publication: PublicationState;
  review_state: ReviewState;
  lifecycle: LifecycleState;
  current_revision_id: string | null;
  approved_revision_id: string | null;
  approved_revision_no: number;
  title: string;
  summary: string;
  description: string;
  category: EventCategory;
  format: EventFormat;
  city: string | null;
  country: string | null;
  venue: string | null;
  timezone: string;
  starts_at: number;
  ends_at: number;
  registration_opens_at: number | null;
  registration_closes_at: number | null;
  registration_closed: number;
  capacity: number | null;
  waitlist_enabled: number;
  confirmed_count: number;
  cover_object_key: string | null;
  cover_mime: string | null;
  search_text: string;
  featured_until: number | null;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface RevisionRow {
  id: string;
  event_id: string;
  revision_no: number;
  review_state: ReviewState;
  title: string;
  summary: string;
  description: string;
  category: EventCategory;
  format: EventFormat;
  city: string | null;
  country: string | null;
  venue: string | null;
  online_url: string | null;
  timezone: string;
  starts_at: number;
  ends_at: number;
  registration_opens_at: number | null;
  registration_closes_at: number | null;
  capacity: number | null;
  waitlist_enabled: number;
  access_info: string | null;
  accessibility: string | null;
  age_limit: number | null;
  cover_object_key: string | null;
  cover_mime: string | null;
  author_user_id: string;
  submitted_at: number | null;
  decided_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface OrganizerRow {
  id: string;
  owner_user_id: string;
  slug: string;
  name: string;
  bio: string;
  website: string | null;
  contact_email: string;
  city: string | null;
  country: string | null;
  status: "active" | "suspended";
  version: number;
  created_at: number;
  updated_at: number;
}

/** Public cover URL. Only ever emitted for an approved, published event. */
export const coverUrlFor = (event: Pick<EventRow, "id" | "cover_object_key" | "updated_at">) =>
  event.cover_object_key ? `/api/events/id/${event.id}/cover?v=${event.updated_at}` : null;

export function availabilityOf(
  event: Pick<
    EventRow,
    | "publication"
    | "lifecycle"
    | "ends_at"
    | "registration_closed"
    | "registration_opens_at"
    | "registration_closes_at"
    | "capacity"
    | "confirmed_count"
    | "waitlist_enabled"
  >,
  now = nowMs(),
): RegistrationAvailability {
  if (event.publication !== "published") return "unlisted";
  if (event.lifecycle === "cancelled") return "cancelled";
  if (event.lifecycle === "postponed") return "postponed";
  if (event.ends_at < now) return "ended";
  if (event.registration_closed) return "closed";
  if (event.registration_closes_at !== null && event.registration_closes_at <= now) return "closed";
  if (event.registration_opens_at !== null && event.registration_opens_at > now) return "not_open";
  if (event.capacity !== null && event.confirmed_count >= event.capacity)
    return event.waitlist_enabled ? "waitlist" : "full";
  return "open";
}

export function remainingSeats(event: Pick<EventRow, "capacity" | "confirmed_count">) {
  if (event.capacity === null) return null;
  return Math.max(0, event.capacity - event.confirmed_count);
}

export function buildSearchText(parts: (string | null | undefined)[]) {
  return parts
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .join(" ")
    .toLowerCase()
    .slice(0, 600);
}

export async function uniqueSlug(db: Db, table: "events" | "organizers", base: string) {
  let candidate = base;
  for (let i = 2; i < 100; i++) {
    const existing = await db
      .prepare(`SELECT id FROM ${table} WHERE slug = ?`)
      .bind(candidate)
      .first<{ id: string }>();
    if (!existing) return candidate;
    candidate = `${base}-${i}`;
  }
  throw err("INVALID_INPUT", "Could not create a unique web address for that name.");
}

export async function requireOrganizerForUser(db: Db, userId: string): Promise<OrganizerRow> {
  const row = await db
    .prepare("SELECT * FROM organizers WHERE owner_user_id = ?")
    .bind(userId)
    .first<OrganizerRow>();
  if (!row) throw err("NOT_FOUND", "Create an organiser profile first.");
  if (row.status === "suspended")
    throw err("FORBIDDEN", "This organiser profile is suspended. Contact Fashley.");
  return row;
}

export async function ownedEvent(
  db: Db,
  organizer: OrganizerRow,
  eventId: string,
): Promise<EventRow> {
  const row = await db
    .prepare("SELECT * FROM events WHERE id = ? AND organizer_id = ?")
    .bind(eventId, organizer.id)
    .first<EventRow>();
  if (!row) throw err("NOT_FOUND", "Event not found.");
  return row;
}

export async function latestRevision(db: Db, eventId: string): Promise<RevisionRow | null> {
  return db
    .prepare("SELECT * FROM event_revisions WHERE event_id = ? ORDER BY revision_no DESC LIMIT 1")
    .bind(eventId)
    .first<RevisionRow>();
}

/**
 * D1/SQLite rejects a guarded write with a raw driver error. Translate the
 * known database guards into the API's error vocabulary so clients get a real
 * status instead of a generic 503, and never a false success.
 */
export function mapDatabaseError(e: unknown): never {
  if (e instanceof Error) {
    const text = e.message ?? "";
    if (text.includes("ORGANIZER_SUSPENDED"))
      throw err("FORBIDDEN", "Restore the organiser before publishing this event.");
    if (text.includes("STALE_WRITE"))
      throw err("REVISION_CONFLICT", "This record changed. Reload and try again.");
    if (text.includes("WAITLIST_NOT_OPEN"))
      throw err("REGISTRATION_CLOSED", "The waitlist is no longer open.");
    if (text.includes("LAST_PLATFORM_ADMIN"))
      throw err("FORBIDDEN", "The last platform admin cannot be removed.");
    if (text.includes("CAPACITY_EXCEEDED"))
      throw err("CAPACITY_UNAVAILABLE", "The last place was just taken.");
    if (text.includes("REGISTRATION_NOT_OPEN"))
      throw err("REGISTRATION_CLOSED", "Registration closed for this event.");
    if (text.includes("STALE_REVISION"))
      throw err("REVISION_CONFLICT", "A newer revision was submitted. Reload before deciding.");
    if (text.includes("UNIQUE constraint failed")) {
      if (text.includes("event_registrations"))
        throw err("INVALID_INPUT", "You are already on the list for this event.");
      if (text.includes("event_tickets"))
        throw err("INVALID_INPUT", "A ticket was already issued for this registration.");
      if (text.includes("event_notification_outbox"))
        throw err("INVALID_INPUT", "That notification was already queued.");
    }
  }
  throw e;
}
