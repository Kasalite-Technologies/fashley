import type { Db } from "@/lib/tailor/server/db";
import { err, newId } from "@/lib/tailor/server/errors";
import { nowMs, toIso } from "@/lib/tailor/server/util";
import { audit } from "./authorization";
import {
  buildSearchText,
  coverUrlFor,
  latestRevision,
  mapDatabaseError,
  remainingSeats,
  uniqueSlug,
  type EventRow,
  type OrganizerRow,
  type RevisionRow,
} from "./store";
import { availabilityOf } from "./store";
import { wallClockToUtcMs, utcMsToWallClock, isSupportedTimeZone } from "./time";
import { outboxStatement } from "./notifications";
import {
  slugify,
  type DraftEventInput,
  type EventCard,
  type EventDetail,
  type OrganizerProfile,
  type Paginated,
} from "@/lib/events/contracts";

export interface DirectoryQuery {
  q: string;
  city: string;
  category: string;
  format: string;
  when: "upcoming" | "past" | "all";
  page: number;
}

const PAGE_SIZE = 12;

function cardOf(row: EventRow & { organizer_slug?: string | null }): EventCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.category,
    format: row.format,
    city: row.city,
    country: row.country,
    timezone: row.timezone,
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    organizerName: row.organizer_name,
    organizerSlug: row.organizer_slug ?? row.slug,
    coverUrl: coverUrlFor(row),
    availability: availabilityOf(row),
  };
}

export async function listDirectory(db: Db, query: DirectoryQuery): Promise<Paginated<EventCard>> {
  const where: string[] = ["e.publication = 'published'", "e.lifecycle != 'cancelled'"];
  const params: unknown[] = [];
  if (query.when === "upcoming") {
    where.push("e.ends_at >= ?");
    params.push(nowMs());
  } else if (query.when === "past") {
    where.push("e.ends_at < ?");
    params.push(nowMs());
  }
  if (query.q) {
    where.push("e.search_text LIKE ?");
    params.push(`%${query.q.toLowerCase()}%`);
  }
  if (query.city) {
    where.push("e.city LIKE ?");
    params.push(`%${query.city}%`);
  }
  if (query.category) {
    where.push("e.category = ?");
    params.push(query.category);
  }
  if (query.format) {
    where.push("e.format = ?");
    params.push(query.format);
  }
  const whereSql = where.join(" AND ");
  const order = query.when === "past" ? "e.starts_at DESC" : "e.starts_at ASC";

  const total = await db
    .prepare(`SELECT COUNT(*) AS count FROM events e WHERE ${whereSql}`)
    .bind(...params)
    .first<{ count: number }>();
  const offset = (query.page - 1) * PAGE_SIZE;
  const { results } = await db
    .prepare(
      `SELECT e.*, o.slug AS organizer_slug FROM events e JOIN organizers o ON o.id = e.organizer_id WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`,
    )
    .bind(...params, PAGE_SIZE, offset)
    .all<EventRow & { organizer_slug: string }>();
  return {
    items: results.map(cardOf),
    total: total?.count ?? 0,
    page: query.page,
    pageSize: PAGE_SIZE,
  };
}

export async function getPublicEvent(db: Db, slug: string): Promise<EventDetail | null> {
  const row = await db
    .prepare("SELECT * FROM events WHERE slug = ? AND publication = 'published'")
    .bind(slug)
    .first<EventRow>();
  if (!row) return null;
  const revision = row.approved_revision_id
    ? await db
        .prepare("SELECT * FROM event_revisions WHERE id = ?")
        .bind(row.approved_revision_id)
        .first<RevisionRow>()
    : null;
  const card = cardOf(row);
  return {
    ...card,
    organizerSlug: await organizerSlugFor(db, row.organizer_id),
    description: row.description,
    venue: row.venue,
    accessibility: revision?.accessibility ?? "",
    accessInfo: null,
    ageLimit: revision?.age_limit ?? null,
    registrationOpensAt:
      row.registration_opens_at !== null ? toIso(row.registration_opens_at) : null,
    registrationClosesAt:
      row.registration_closes_at !== null ? toIso(row.registration_closes_at) : null,
    capacity: row.capacity,
    remaining: remainingSeats(row),
    waitlistEnabled: row.waitlist_enabled === 1,
    lifecycle: row.lifecycle,
    updatedAt: toIso(row.updated_at),
  };
}

async function organizerSlugFor(db: Db, organizerId: string) {
  const row = await db
    .prepare("SELECT slug FROM organizers WHERE id = ?")
    .bind(organizerId)
    .first<{ slug: string }>();
  return row?.slug ?? "organiser";
}

export async function getOrganizerProfile(db: Db, slug: string): Promise<OrganizerProfile | null> {
  const organizer = await db
    .prepare("SELECT * FROM organizers WHERE slug = ? AND status = 'active'")
    .bind(slug)
    .first<OrganizerRow>();
  if (!organizer) return null;
  const { results } = await db
    .prepare(
      "SELECT e.*, o.slug AS organizer_slug FROM events e JOIN organizers o ON o.id = e.organizer_id WHERE e.organizer_id = ? AND e.publication = 'published' ORDER BY e.starts_at DESC LIMIT 60",
    )
    .bind(organizer.id)
    .all<EventRow & { organizer_slug: string }>();
  return {
    slug: organizer.slug,
    name: organizer.name,
    bio: organizer.bio,
    city: organizer.city,
    country: organizer.country,
    website: organizer.website,
    events: results.map(cardOf),
  };
}

export async function listCities(db: Db): Promise<string[]> {
  const { results } = await db
    .prepare(
      "SELECT city, COUNT(*) AS count FROM events WHERE publication = 'published' AND city IS NOT NULL AND city != '' GROUP BY city ORDER BY count DESC LIMIT 24",
    )
    .all<{ city: string }>();
  return results.map((r) => r.city);
}

export async function featuredEvents(db: Db, limit = 3): Promise<EventCard[]> {
  const { results } = await db
    .prepare(
      "SELECT e.*, o.slug AS organizer_slug FROM events e JOIN organizers o ON o.id = e.organizer_id WHERE e.publication = 'published' AND e.lifecycle = 'scheduled' AND e.featured_until IS NOT NULL AND e.featured_until > ? AND e.ends_at >= ? ORDER BY e.starts_at ASC LIMIT ?",
    )
    .bind(nowMs(), nowMs(), limit)
    .all<EventRow & { organizer_slug: string }>();
  return results.map(cardOf);
}

// ---- Organiser profile ----

export async function getMyOrganizer(db: Db, userId: string) {
  const row = await db
    .prepare("SELECT * FROM organizers WHERE owner_user_id = ?")
    .bind(userId)
    .first<OrganizerRow>();
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    bio: row.bio,
    city: row.city,
    country: row.country,
    website: row.website,
    contactEmail: row.contact_email,
    status: row.status,
  };
}

export async function saveOrganizerProfile(
  db: Db,
  userId: string,
  input: {
    name: string;
    bio: string;
    city: string;
    country: string;
    website: string;
    contactEmail: string;
  },
) {
  const existing = await db
    .prepare("SELECT * FROM organizers WHERE owner_user_id = ?")
    .bind(userId)
    .first<OrganizerRow>();
  const now = nowMs();
  if (existing) {
    await db
      .prepare(
        "UPDATE organizers SET name = ?, bio = ?, city = ?, country = ?, website = ?, contact_email = ?, version = version + 1, updated_at = ? WHERE id = ?",
      )
      .bind(
        input.name,
        input.bio,
        input.city || null,
        input.country || null,
        input.website || null,
        input.contactEmail,
        now,
        existing.id,
      )
      .run();
    return getMyOrganizer(db, userId);
  }
  const id = newId("org");
  const slug = await uniqueSlug(db, "organizers", slugify(input.name));
  await db
    .prepare(
      "INSERT INTO organizers (id, owner_user_id, slug, name, bio, website, contact_email, city, country, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)",
    )
    .bind(
      id,
      userId,
      slug,
      input.name,
      input.bio,
      input.website || null,
      input.contactEmail,
      input.city || null,
      input.country || null,
      now,
      now,
    )
    .run();
  await audit(db, userId, "organizer.create", "organizer", id, { name: input.name });
  return getMyOrganizer(db, userId);
}

// ---- Event drafting ----

function validateSchedule(input: DraftEventInput) {
  if (!isSupportedTimeZone(input.timezone))
    throw err("INVALID_INPUT", "Use a timezone name such as Africa/Accra or Europe/London.");
  const startsAt = wallClockToUtcMs(input.startsAt, input.timezone);
  const endsAt = wallClockToUtcMs(input.endsAt, input.timezone);
  if (endsAt <= startsAt) throw err("INVALID_INPUT", "The event must end after it starts.");
  const opensAt = input.registrationOpensAt
    ? wallClockToUtcMs(input.registrationOpensAt, input.timezone)
    : null;
  const closesAt = input.registrationClosesAt
    ? wallClockToUtcMs(input.registrationClosesAt, input.timezone)
    : null;
  if (opensAt !== null && closesAt !== null && closesAt <= opensAt)
    throw err("INVALID_INPUT", "Registration must close after it opens.");
  if (closesAt !== null && closesAt > endsAt)
    throw err("INVALID_INPUT", "Registration cannot close after the event ends.");
  if (input.format !== "online" && !input.venue.trim())
    throw err("INVALID_INPUT", "Add a venue for an in-person event.");
  if (input.format !== "in_person" && !input.onlineUrl.trim())
    throw err("INVALID_INPUT", "Add the joining link for an online event.");
  let capacity: number | null = null;
  if (input.capacity) {
    const parsed = Number(input.capacity);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100_000)
      throw err("INVALID_INPUT", "Capacity must be a whole number from 1 to 100000.");
    capacity = parsed;
  }
  const ageLimit = input.ageLimit ? Number(input.ageLimit) : null;
  if (ageLimit !== null && (!Number.isInteger(ageLimit) || ageLimit < 0 || ageLimit > 99))
    throw err("INVALID_INPUT", "Age limit must be a whole number from 0 to 99.");
  return { startsAt, endsAt, opensAt, closesAt, capacity, ageLimit };
}

export async function saveEventDraft(
  db: Db,
  params: {
    userId: string;
    organizer: OrganizerRow;
    eventId?: string | undefined;
    input: DraftEventInput;
  },
) {
  const { input } = params;
  const schedule = validateSchedule(input);
  const now = nowMs();

  let event: EventRow;
  if (params.eventId) {
    event = await ownedEventRow(db, params.organizer.id, params.eventId);
    if (event.review_state === "submitted")
      throw err("FORBIDDEN", "This event is in review. Withdraw it before editing.");
  } else {
    const id = newId("evt");
    const slug = await uniqueSlug(db, "events", slugify(input.title));
    await db
      .prepare(
        "INSERT INTO events (id, slug, organizer_id, organizer_name, publication, review_state, lifecycle, title, summary, description, category, format, city, country, venue, timezone, starts_at, ends_at, registration_opens_at, registration_closes_at, registration_closed, capacity, waitlist_enabled, confirmed_count, search_text, version, created_at, updated_at) VALUES (?, ?, ?, ?, 'unpublished', 'draft', 'scheduled', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, 1, ?, ?)",
      )
      .bind(
        id,
        slug,
        params.organizer.id,
        params.organizer.name,
        input.title,
        input.summary,
        input.description,
        input.category,
        input.format,
        input.city || null,
        input.country || null,
        input.venue || null,
        input.timezone,
        schedule.startsAt,
        schedule.endsAt,
        schedule.opensAt,
        schedule.closesAt,
        schedule.capacity,
        input.waitlistEnabled ? 1 : 0,
        buildSearchText([
          input.title,
          input.summary,
          input.city,
          input.country,
          params.organizer.name,
        ]),
        now,
        now,
      )
      .run();
    event = await ownedEventRow(db, params.organizer.id, id);
  }

  const current = await latestRevision(db, event.id);
  // Only a working revision is edited in place. Approved, rejected, withdrawn
  // and submitted revisions are history, so a change starts a new one.
  const editableRevision =
    current && (current.review_state === "draft" || current.review_state === "changes_requested");
  const revisionId = editableRevision ? current.id : newId("rev");
  const revisionNo = editableRevision ? current.revision_no : (current?.revision_no ?? 0) + 1;
  // Content columns, in the order both statements below expect.
  const content = [
    input.title,
    input.summary,
    input.description,
    input.category,
    input.format,
    input.city || null,
    input.country || null,
    input.venue || null,
    input.onlineUrl || null,
    input.timezone,
    schedule.startsAt,
    schedule.endsAt,
    schedule.opensAt,
    schedule.closesAt,
    schedule.capacity,
    input.waitlistEnabled ? 1 : 0,
    input.accessInfo || null,
    input.accessibility || null,
    schedule.ageLimit,
  ];

  const statements = [];
  if (editableRevision) {
    statements.push(
      db
        .prepare(
          "UPDATE event_revisions SET review_state = 'draft', title = ?, summary = ?, description = ?, category = ?, format = ?, city = ?, country = ?, venue = ?, online_url = ?, timezone = ?, starts_at = ?, ends_at = ?, registration_opens_at = ?, registration_closes_at = ?, capacity = ?, waitlist_enabled = ?, access_info = ?, accessibility = ?, age_limit = ?, updated_at = ? WHERE id = ?",
        )
        .bind(...content, now, current.id),
    );
  } else {
    statements.push(
      db
        .prepare(
          "INSERT INTO event_revisions (id, event_id, revision_no, review_state, title, summary, description, category, format, city, country, venue, online_url, timezone, starts_at, ends_at, registration_opens_at, registration_closes_at, capacity, waitlist_enabled, access_info, accessibility, age_limit, author_user_id, submitted_at, decided_at, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)",
        )
        .bind(revisionId, event.id, revisionNo, ...content, params.userId, now, now),
    );
  }

  // A published listing keeps serving its approved snapshot while a draft is
  // being written: the public columns of `events` are only replaced when an
  // editor approves a revision. Unpublished drafts may update them directly.
  if (event.approved_revision_id) {
    statements.push(
      db
        .prepare(
          "UPDATE events SET review_state = 'draft', current_revision_id = ?, version = ?, updated_at = ? WHERE id = ?",
        )
        .bind(revisionId, event.version + 1, now, event.id),
    );
  } else {
    statements.push(
      db
        .prepare(
          "UPDATE events SET title = ?, summary = ?, description = ?, category = ?, format = ?, city = ?, country = ?, venue = ?, timezone = ?, starts_at = ?, ends_at = ?, registration_opens_at = ?, registration_closes_at = ?, capacity = ?, waitlist_enabled = ?, review_state = 'draft', current_revision_id = ?, search_text = ?, version = ?, updated_at = ? WHERE id = ?",
        )
        .bind(
          input.title,
          input.summary,
          input.description,
          input.category,
          input.format,
          input.city || null,
          input.country || null,
          input.venue || null,
          input.timezone,
          schedule.startsAt,
          schedule.endsAt,
          schedule.opensAt,
          schedule.closesAt,
          schedule.capacity,
          input.waitlistEnabled ? 1 : 0,
          revisionId,
          buildSearchText([
            input.title,
            input.summary,
            input.city,
            input.country,
            params.organizer.name,
          ]),
          event.version + 1,
          now,
          event.id,
        ),
    );
  }
  try {
    await db.batch(statements);
  } catch (e) {
    mapDatabaseError(e);
  }
  return getEventForEditor(db, params.organizer.id, event.id, params.userId);
}

async function ownedEventRow(db: Db, organizerId: string, eventId: string): Promise<EventRow> {
  const row = await db
    .prepare("SELECT * FROM events WHERE id = ? AND organizer_id = ?")
    .bind(eventId, organizerId)
    .first<EventRow>();
  if (!row) throw err("NOT_FOUND", "Event not found.");
  return row;
}

export async function submitEvent(
  db: Db,
  params: { userId: string; organizer: OrganizerRow; eventId: string },
) {
  const event = await ownedEventRow(db, params.organizer.id, params.eventId);
  if (event.review_state === "submitted")
    throw err("INVALID_INPUT", "This event is already in review.");
  const revision = await latestRevision(db, event.id);
  if (!revision) throw err("INVALID_INPUT", "Save the event details before submitting.");
  if (revision.review_state !== "draft" && revision.review_state !== "changes_requested")
    throw err("INVALID_INPUT", "Save a new draft before submitting this event again.");
  if (revision.ends_at < nowMs())
    throw err("INVALID_INPUT", "The event date has passed. Update the schedule first.");
  const now = nowMs();
  await db.batch([
    db
      .prepare(
        "UPDATE event_revisions SET review_state = 'submitted', submitted_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(now, now, revision.id),
    db
      .prepare(
        "UPDATE events SET review_state = 'submitted', version = ?, updated_at = ? WHERE id = ?",
      )
      .bind(event.version + 1, now, event.id),
    outboxStatement(db, {
      deliveryKey: `submit:${revision.id}`,
      kind: "submission_received",
      eventId: event.id,
      recipientEmail: params.organizer.contact_email,
      payload: {
        eventTitle: event.title,
        when: toIso(event.starts_at),
      },
    }),
  ]);
  await audit(db, params.userId, "event.submit", "event", event.id, {
    revisionNo: revision.revision_no,
  });
  return getEventForEditor(db, params.organizer.id, event.id, params.userId);
}

export async function withdrawEvent(
  db: Db,
  params: { userId: string; organizer: OrganizerRow; eventId: string },
) {
  const event = await ownedEventRow(db, params.organizer.id, params.eventId);
  if (event.review_state !== "submitted")
    throw err("INVALID_INPUT", "Only a submission in review can be withdrawn.");
  const revision = await latestRevision(db, event.id);
  const now = nowMs();
  await db.batch([
    ...(revision
      ? [
          db
            .prepare(
              "UPDATE event_revisions SET review_state = 'withdrawn', updated_at = ? WHERE id = ?",
            )
            .bind(now, revision.id),
        ]
      : []),
    db
      .prepare(
        "UPDATE events SET review_state = 'withdrawn', version = ?, updated_at = ? WHERE id = ?",
      )
      .bind(event.version + 1, now, event.id),
  ]);
  await audit(db, params.userId, "event.withdraw", "event", event.id, {});
  return getEventForEditor(db, params.organizer.id, event.id, params.userId);
}

export async function getEventForEditor(
  db: Db,
  organizerId: string,
  eventId: string,
  _userId: string,
) {
  const event = await ownedEventRow(db, organizerId, eventId);
  const revision = await latestRevision(db, event.id);
  const review = await db
    .prepare("SELECT * FROM event_reviews WHERE event_id = ? ORDER BY created_at DESC LIMIT 1")
    .bind(event.id)
    .first<{ organizer_message: string }>();
  const organizer = await db
    .prepare("SELECT * FROM organizers WHERE id = ?")
    .bind(organizerId)
    .first<OrganizerRow>();
  const source = revision ?? {
    title: event.title,
    summary: event.summary,
    description: event.description,
    category: event.category,
    format: event.format,
    city: event.city,
    country: event.country,
    venue: event.venue,
    online_url: null,
    timezone: event.timezone,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    registration_opens_at: event.registration_opens_at,
    registration_closes_at: event.registration_closes_at,
    capacity: event.capacity,
    waitlist_enabled: event.waitlist_enabled,
    access_info: null,
    accessibility: null,
    age_limit: null,
  };
  const editable = event.review_state !== "submitted";
  const stats = await db
    .prepare(
      "SELECT (SELECT COUNT(*) FROM event_registrations g WHERE g.event_id = ? AND g.state = 'confirmed') AS confirmed, (SELECT COUNT(*) FROM event_registrations g WHERE g.event_id = ? AND g.state = 'waitlisted') AS waitlisted, (SELECT COUNT(*) FROM event_registrations g WHERE g.event_id = ? AND g.checked_in_at IS NOT NULL) AS checked",
    )
    .bind(event.id, event.id, event.id)
    .first<{ confirmed: number; waitlisted: number; checked: number }>();
  return {
    id: event.id,
    slug: event.slug,
    reviewState: event.review_state,
    publication: event.publication,
    lifecycle: event.lifecycle,
    revisionId: revision?.id ?? "",
    title: source.title,
    summary: source.summary,
    description: source.description,
    category: source.category,
    format: source.format,
    city: source.city ?? "",
    country: source.country ?? "",
    venue: source.venue ?? "",
    onlineUrl: source.online_url ?? "",
    timezone: source.timezone,
    startsAt: utcMsToWallClock(source.starts_at, source.timezone),
    endsAt: utcMsToWallClock(source.ends_at, source.timezone),
    registrationOpensAt: source.registration_opens_at
      ? utcMsToWallClock(source.registration_opens_at, source.timezone)
      : "",
    registrationClosesAt: source.registration_closes_at
      ? utcMsToWallClock(source.registration_closes_at, source.timezone)
      : "",
    capacity: source.capacity !== null ? String(source.capacity) : "",
    waitlistEnabled: source.waitlist_enabled === 1,
    accessInfo: source.access_info ?? "",
    accessibility: source.accessibility ?? "",
    ageLimit: source.age_limit !== null ? String(source.age_limit) : "",
    coverUrl: revision?.cover_object_key
      ? `/api/events/id/${event.id}/cover?revision=${revision.id}&v=${revision.updated_at}`
      : coverUrlFor(event),
    canEdit: editable,
    organizerMessage: review?.organizer_message ?? null,
    organizerSlug: organizer?.slug ?? "",
    organizerName: organizer?.name ?? "",
    registrationClosed: event.registration_closed === 1,
    confirmedCount: stats?.confirmed ?? event.confirmed_count,
    waitlistedCount: stats?.waitlisted ?? 0,
    checkedInCount: stats?.checked ?? 0,
  };
}

export async function listMyEvents(db: Db, organizerId: string) {
  const { results } = await db
    .prepare("SELECT * FROM events WHERE organizer_id = ? ORDER BY updated_at DESC LIMIT 100")
    .bind(organizerId)
    .all<EventRow>();
  const reviews = await db
    .prepare(
      "SELECT event_id, organizer_message FROM event_reviews WHERE event_id IN (SELECT id FROM events WHERE organizer_id = ?) ORDER BY created_at DESC",
    )
    .bind(organizerId)
    .all<{ event_id: string; organizer_message: string }>();
  const messageByEvent = new Map<string, string>();
  for (const r of reviews.results)
    if (!messageByEvent.has(r.event_id)) messageByEvent.set(r.event_id, r.organizer_message);
  const counts = await db
    .prepare(
      "SELECT event_id, state, COUNT(*) AS count FROM event_registrations WHERE event_id IN (SELECT id FROM events WHERE organizer_id = ?) GROUP BY event_id, state",
    )
    .bind(organizerId)
    .all<{ event_id: string; state: string; count: number }>();
  const countMap = new Map<string, number>();
  for (const c of counts.results) countMap.set(`${c.event_id}:${c.state}`, c.count);
  return results.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    reviewState: row.review_state,
    publication: row.publication,
    lifecycle: row.lifecycle,
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    timezone: row.timezone,
    city: row.city,
    format: row.format,
    confirmedCount: countMap.get(`${row.id}:confirmed`) ?? row.confirmed_count,
    waitlistedCount: countMap.get(`${row.id}:waitlisted`) ?? 0,
    capacity: row.capacity,
    registrationClosed: row.registration_closed === 1,
    updatedAt: toIso(row.updated_at),
    submittedAt: null,
    organizerMessage: messageByEvent.get(row.id) ?? null,
  }));
}

export async function setRegistrationClosed(
  db: Db,
  params: { userId: string; organizer: OrganizerRow; eventId: string; closed: boolean },
) {
  const event = await ownedEventRow(db, params.organizer.id, params.eventId);
  if (event.lifecycle !== "scheduled")
    throw err("INVALID_INPUT", "This event is not accepting registrations.");
  await db
    .prepare(
      "UPDATE events SET registration_closed = ?, version = version + 1, updated_at = ? WHERE id = ?",
    )
    .bind(params.closed ? 1 : 0, nowMs(), event.id)
    .run();
  await audit(
    db,
    params.userId,
    params.closed ? "event.registration_close" : "event.registration_open",
    "event",
    event.id,
    {},
  );
  return { ok: true };
}

export async function cancelOwnedEvent(
  db: Db,
  params: { userId: string; organizer: OrganizerRow; eventId: string; reason: string },
) {
  const event = await ownedEventRow(db, params.organizer.id, params.eventId);
  if (event.lifecycle === "cancelled") return { ok: true };
  const now = nowMs();
  const regs = await db
    .prepare(
      "SELECT id, email, display_name FROM event_registrations WHERE event_id = ? AND state = 'confirmed'",
    )
    .bind(event.id)
    .all<{ id: string; email: string; display_name: string }>();
  const statements = [
    db
      .prepare(
        "UPDATE events SET lifecycle = 'cancelled', registration_closed = 1, version = version + 1, updated_at = ? WHERE id = ?",
      )
      .bind(now, event.id),
    ...regs.results.map((r) =>
      outboxStatement(db, {
        deliveryKey: `cancel:${event.id}:${r.id}`,
        kind: "event_cancelled",
        eventId: event.id,
        registrationId: r.id,
        recipientEmail: r.email,
        payload: { eventTitle: event.title, message: params.reason },
      }),
    ),
  ];
  await db.batch(statements);
  await audit(db, params.userId, "event.cancel", "event", event.id, { reason: params.reason });
  return { ok: true };
}
