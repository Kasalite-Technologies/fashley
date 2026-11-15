import type { Db } from "@/lib/tailor/server/db";
import { err, newId } from "@/lib/tailor/server/errors";
import { nowMs, randomToken, sha256Hex, toIso } from "@/lib/tailor/server/util";
import { audit } from "./authorization";
import { outboxStatement } from "./notifications";
import {
  availabilityOf,
  mapDatabaseError,
  type EventRow,
  type OrganizerRow,
  type RevisionRow,
} from "./store";
import type {
  AttendeeRow,
  EventFormat,
  LifecycleState,
  OwnRegistration,
  PublicationState,
  RegistrationState,
} from "@/lib/events/contracts";

export interface RegistrationRow {
  id: string;
  event_id: string;
  user_id: string;
  state: RegistrationState;
  display_name: string;
  email: string;
  phone: string | null;
  answers_json: string;
  revision_id: string | null;
  registered_at: number;
  cancelled_at: number | null;
  checked_in_at: number | null;
  version: number;
  updated_at: number;
}

export async function registerForEvent(
  db: Db,
  params: {
    userId: string;
    event: EventRow;
    input: {
      displayName: string;
      email: string;
      phone: string;
      accessibilityRequest: string;
    };
    wantsWaitlist: boolean;
  },
) {
  const { event, userId, input } = params;
  const now = nowMs();
  const availability = availabilityOf(event, now);
  if (availability === "unlisted") throw err("NOT_FOUND", "Event not found.");
  if (availability === "cancelled" || availability === "postponed")
    throw err("REGISTRATION_CLOSED", "This event is not accepting registrations.");
  if (availability === "ended") throw err("REGISTRATION_CLOSED", "This event has ended.");
  if (availability === "closed" || availability === "not_open")
    throw err("REGISTRATION_CLOSED", "Registration is not open for this event.");

  const existing = await db
    .prepare("SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?")
    .bind(event.id, userId)
    .first<RegistrationRow>();
  if (existing && existing.state !== "cancelled")
    throw err("INVALID_INPUT", "You are already on the list for this event.");

  const revision = event.approved_revision_id
    ? await db
        .prepare("SELECT * FROM event_revisions WHERE id = ?")
        .bind(event.approved_revision_id)
        .first<RevisionRow>()
    : null;

  const full = event.capacity !== null && event.confirmed_count >= event.capacity;
  if (params.wantsWaitlist) {
    if (!event.waitlist_enabled) throw err("CAPACITY_UNAVAILABLE", "This event has no waitlist.");
    if (!full)
      throw err(
        "INVALID_INPUT",
        "There are still places. Register instead of joining the waitlist.",
      );
  } else if (full) {
    throw err(
      "CAPACITY_UNAVAILABLE",
      event.waitlist_enabled
        ? "This event is full. Join the waitlist to be considered for a place."
        : "This event is full.",
    );
  }
  const wantWaitlist = params.wantsWaitlist;

  const registrationId = existing?.id ?? newId("reg");
  const answers = JSON.stringify(
    input.accessibilityRequest ? { accessibilityRequest: input.accessibilityRequest } : {},
  );
  const credential = wantWaitlist ? null : randomToken(24);
  const credentialHash = credential ? await sha256Hex(credential) : null;

  /**
   * One atomic batch: the row that becomes confirmed, the guarded counter, the
   * ticket and the notification either all commit or all roll back. Capacity
   * and window checks live in database triggers, so a concurrent last-seat
   * request aborts the whole batch instead of confirming an oversold seat.
   */
  const statements = [];
  if (existing) {
    statements.push(
      db
        .prepare(
          "UPDATE event_registrations SET state = ?, display_name = ?, email = ?, phone = ?, answers_json = ?, revision_id = ?, registered_at = ?, cancelled_at = NULL, checked_in_at = NULL, version = ?, updated_at = ? WHERE id = ?",
        )
        .bind(
          wantWaitlist ? "waitlisted" : "confirmed",
          input.displayName,
          input.email,
          input.phone || null,
          answers,
          revision?.id ?? null,
          now,
          existing.version + 1,
          now,
          registrationId,
        ),
    );
  } else {
    statements.push(
      db
        .prepare(
          "INSERT INTO event_registrations (id, event_id, user_id, state, display_name, email, phone, answers_json, revision_id, registered_at, cancelled_at, checked_in_at, version, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 1, ?)",
        )
        .bind(
          registrationId,
          event.id,
          userId,
          wantWaitlist ? "waitlisted" : "confirmed",
          input.displayName,
          input.email,
          input.phone || null,
          answers,
          revision?.id ?? null,
          now,
          now,
        ),
    );
  }
  if (!wantWaitlist) {
    statements.push(
      db
        .prepare(
          "UPDATE event_tickets SET revoked_at = ? WHERE registration_id = ? AND revoked_at IS NULL",
        )
        .bind(now, registrationId),
      db
        .prepare(
          "INSERT INTO event_tickets (id, registration_id, event_id, credential, credential_hash, issued_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
        )
        .bind(newId("tkt"), registrationId, event.id, credential, credentialHash, now),
    );
  }
  statements.push(
    outboxStatement(db, {
      deliveryKey: `register:${registrationId}:${now}`,
      kind: wantWaitlist ? "registration_waitlisted" : "registration_confirmed",
      eventId: event.id,
      registrationId,
      recipientEmail: input.email,
      payload: { eventTitle: event.title, when: toIso(event.starts_at) },
    }),
  );
  try {
    await db.batch(statements);
  } catch (e) {
    mapDatabaseError(e);
  }
  return getOwnRegistration(db, userId, registrationId);
}

export async function getOwnRegistration(
  db: Db,
  userId: string,
  registrationId: string,
): Promise<OwnRegistration> {
  const row = await db
    .prepare("SELECT * FROM event_registrations WHERE id = ? AND user_id = ?")
    .bind(registrationId, userId)
    .first<RegistrationRow>();
  if (!row) throw err("NOT_FOUND", "Registration not found.");
  const event = await db
    .prepare("SELECT * FROM events WHERE id = ?")
    .bind(row.event_id)
    .first<EventRow>();
  if (!event) throw err("NOT_FOUND", "Registration not found.");
  const revision = event.approved_revision_id
    ? await db
        .prepare("SELECT * FROM event_revisions WHERE id = ?")
        .bind(event.approved_revision_id)
        .first<RevisionRow>()
    : null;
  const confirmed = row.state === "confirmed";
  return {
    id: row.id,
    eventId: event.id,
    eventSlug: event.slug,
    eventTitle: event.title,
    eventStartsAt: toIso(event.starts_at),
    eventEndsAt: toIso(event.ends_at),
    eventTimezone: event.timezone,
    eventCity: event.city,
    eventFormat: event.format,
    eventLifecycle: event.lifecycle,
    eventPublication: event.publication,
    state: row.state,
    registeredAt: toIso(row.registered_at),
    checkedInAt: row.checked_in_at ? toIso(row.checked_in_at) : null,
    accessInfo: confirmed ? (revision?.access_info ?? null) : null,
    onlineUrl:
      confirmed && (event.format === "online" || event.format === "hybrid")
        ? (revision?.online_url ?? null)
        : null,
  };
}

export async function listMyRegistrations(db: Db, userId: string) {
  const { results } = await db
    .prepare(
      "SELECT r.*, e.title, e.slug, e.starts_at, e.ends_at, e.timezone, e.city, e.format, e.lifecycle, e.publication, v.access_info, v.online_url FROM event_registrations r JOIN events e ON e.id = r.event_id LEFT JOIN event_revisions v ON v.id = e.approved_revision_id WHERE r.user_id = ? ORDER BY e.starts_at DESC LIMIT 100",
    )
    .bind(userId)
    .all<
      RegistrationRow & {
        title: string;
        slug: string;
        starts_at: number;
        ends_at: number;
        timezone: string;
        city: string | null;
        format: EventFormat;
        lifecycle: LifecycleState;
        publication: PublicationState;
        access_info: string | null;
        online_url: string | null;
      }
    >();
  return results.map((r) => ({
    id: r.id,
    eventId: r.event_id,
    eventSlug: r.slug,
    eventTitle: r.title,
    eventStartsAt: toIso(r.starts_at),
    eventEndsAt: toIso(r.ends_at),
    eventTimezone: r.timezone,
    eventCity: r.city,
    eventFormat: r.format,
    eventLifecycle: r.lifecycle,
    eventPublication: r.publication,
    state: r.state,
    registeredAt: toIso(r.registered_at),
    checkedInAt: r.checked_in_at ? toIso(r.checked_in_at) : null,
    accessInfo: r.state === "confirmed" ? r.access_info : null,
    onlineUrl: r.state === "confirmed" && r.format !== "in_person" ? r.online_url : null,
  }));
}

export async function cancelRegistration(
  db: Db,
  params: { userId: string; registrationId: string },
) {
  const row = await db
    .prepare("SELECT * FROM event_registrations WHERE id = ? AND user_id = ?")
    .bind(params.registrationId, params.userId)
    .first<RegistrationRow>();
  if (!row) throw err("NOT_FOUND", "Registration not found.");
  if (row.state === "cancelled") return { ok: true, state: "cancelled" };
  const now = nowMs();
  const event = await db
    .prepare("SELECT * FROM events WHERE id = ?")
    .bind(row.event_id)
    .first<EventRow>();
  const wasConfirmed = row.state === "confirmed";
  try {
    await db.batch([
      db
        .prepare(
          "UPDATE event_registrations SET state = 'cancelled', cancelled_at = ?, version = ?, updated_at = ? WHERE id = ?",
        )
        .bind(now, row.version + 1, now, row.id),
      db
        .prepare(
          "UPDATE event_tickets SET revoked_at = ? WHERE registration_id = ? AND revoked_at IS NULL",
        )
        .bind(now, row.id),
      outboxStatement(db, {
        deliveryKey: `self-cancel:${row.id}:${row.version}`,
        kind: "registration_cancelled",
        eventId: row.event_id,
        registrationId: row.id,
        recipientEmail: row.email,
        payload: { eventTitle: event?.title ?? "your event" },
      }),
    ]);
  } catch (e) {
    mapDatabaseError(e);
  }
  if (wasConfirmed && event?.waitlist_enabled === 1 && event.capacity !== null) {
    const waiting = await db
      .prepare(
        "SELECT * FROM event_registrations WHERE event_id = ? AND state = 'waitlisted' ORDER BY registered_at ASC LIMIT 1",
      )
      .bind(row.event_id)
      .first<RegistrationRow>();
    if (waiting) {
      const organizer = await db
        .prepare("SELECT contact_email FROM organizers WHERE id = ?")
        .bind(event.organizer_id)
        .first<{ contact_email: string }>();
      if (!organizer) return { ok: true, state: "cancelled" };
      await outboxStatement(db, {
        deliveryKey: `seat:${row.event_id}:${now}`,
        kind: "seat_available",
        eventId: row.event_id,
        recipientEmail: organizer.contact_email,
        payload: { eventTitle: event.title, when: toIso(event.starts_at) },
      }).run();
    }
  }
  return { ok: true, state: "cancelled" };
}

export async function ticketCredential(
  db: Db,
  userId: string,
  registrationId: string,
): Promise<{ credential: string; checkedInAt: string | null }> {
  const reg = await db
    .prepare("SELECT * FROM event_registrations WHERE id = ? AND user_id = ?")
    .bind(registrationId, userId)
    .first<RegistrationRow>();
  if (!reg) throw err("NOT_FOUND", "Registration not found.");
  if (reg.state !== "confirmed") throw err("FORBIDDEN", "This ticket is not valid.");
  const ticket = await db
    .prepare("SELECT * FROM event_tickets WHERE registration_id = ? AND revoked_at IS NULL")
    .bind(registrationId)
    .first<{ credential: string }>();
  if (!ticket) throw err("NOT_FOUND", "Ticket not issued.");
  return {
    credential: ticket.credential,
    checkedInAt: reg.checked_in_at ? toIso(reg.checked_in_at) : null,
  };
}

// ---- Organiser attendee management ----

export async function listEventAttendees(db: Db, eventId: string): Promise<AttendeeRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM event_registrations WHERE event_id = ? ORDER BY registered_at ASC")
    .bind(eventId)
    .all<RegistrationRow>();
  return results.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    email: r.email,
    phone: r.phone,
    state: r.state,
    registeredAt: toIso(r.registered_at),
    checkedInAt: r.checked_in_at ? toIso(r.checked_in_at) : null,
  }));
}

export async function promoteWaitlisted(
  db: Db,
  params: { userId: string; event: EventRow; registrationId: string },
) {
  const row = await db
    .prepare("SELECT * FROM event_registrations WHERE id = ? AND event_id = ?")
    .bind(params.registrationId, params.event.id)
    .first<RegistrationRow>();
  if (!row) throw err("NOT_FOUND", "That waitlisted person is not on this event.");
  if (row.state !== "waitlisted")
    throw err("INVALID_INPUT", "Only a waitlisted person can be promoted.");
  const now = nowMs();
  const availability = availabilityOf(params.event, now);
  if (availability !== "open" && availability !== "waitlist")
    throw err("REGISTRATION_CLOSED", "Registration is closed for this event.");
  const credential = randomToken(24);
  const hash = await sha256Hex(credential);
  try {
    await db.batch([
      db
        .prepare(
          "UPDATE event_registrations SET state = 'confirmed', version = ?, updated_at = ? WHERE id = ?",
        )
        .bind(row.version + 1, now, row.id),
      db
        .prepare(
          "UPDATE event_tickets SET revoked_at = ? WHERE registration_id = ? AND revoked_at IS NULL",
        )
        .bind(now, row.id),
      db
        .prepare(
          "INSERT INTO event_tickets (id, registration_id, event_id, credential, credential_hash, issued_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
        )
        .bind(newId("tkt"), row.id, params.event.id, credential, hash, now),
      outboxStatement(db, {
        deliveryKey: `promote:${row.id}:${row.version}`,
        kind: "promotion_confirmed",
        eventId: params.event.id,
        registrationId: row.id,
        recipientEmail: row.email,
        payload: { eventTitle: params.event.title, when: toIso(params.event.starts_at) },
      }),
    ]);
  } catch (e) {
    mapDatabaseError(e);
  }
  await audit(db, params.userId, "registration.promote", "event_registration", row.id, {
    eventId: params.event.id,
  });
  return { ok: true };
}

// ---- Check-in ----

export async function checkInByCredential(
  db: Db,
  params: { userId: string; event: EventRow; credential: string },
) {
  const hash = await sha256Hex(params.credential);
  const ticket = await db
    .prepare("SELECT * FROM event_tickets WHERE credential_hash = ? AND revoked_at IS NULL")
    .bind(hash)
    .first<{ id: string; registration_id: string; event_id: string }>();
  if (!ticket || ticket.event_id !== params.event.id)
    throw err("NOT_FOUND", "That ticket is not valid for this event.");
  return checkInRegistration(db, {
    userId: params.userId,
    event: params.event,
    registrationId: ticket.registration_id,
    credentialHash: hash,
  });
}

export async function checkInRegistration(
  db: Db,
  params: { userId: string; event: EventRow; registrationId: string; credentialHash?: string },
) {
  const reg = await db
    .prepare("SELECT * FROM event_registrations WHERE id = ? AND event_id = ?")
    .bind(params.registrationId, params.event.id)
    .first<RegistrationRow>();
  if (!reg) throw err("NOT_FOUND", "That person is not registered for this event.");
  if (reg.state !== "confirmed")
    throw err("FORBIDDEN", "Only a confirmed registration can be checked in.");
  if (reg.checked_in_at)
    return {
      state: "already_checked_in" as const,
      checkedInAt: toIso(reg.checked_in_at),
      displayName: reg.display_name,
    };
  const now = nowMs();
  let results;
  try {
    results = await db.batch([
      db
        .prepare(
          "UPDATE event_registrations SET checked_in_at = ?, version = ?, updated_at = ? WHERE id = ? AND checked_in_at IS NULL AND (? IS NULL OR EXISTS (SELECT 1 FROM event_tickets WHERE registration_id = ? AND credential_hash = ? AND revoked_at IS NULL))",
        )
        .bind(
          now,
          reg.version + 1,
          now,
          reg.id,
          params.credentialHash ?? null,
          reg.id,
          params.credentialHash ?? null,
        ),
      db
        .prepare(
          "INSERT INTO event_check_ins (id, event_id, registration_id, actor_user_id, action, created_at) SELECT ?, ?, ?, ?, 'check_in', ? WHERE changes() = 1",
        )
        .bind(newId("chk"), params.event.id, reg.id, params.userId, now),
    ]);
  } catch (e) {
    mapDatabaseError(e);
  }
  if (!results[0]?.changes) {
    const latest = await db
      .prepare("SELECT checked_in_at FROM event_registrations WHERE id = ?")
      .bind(reg.id)
      .first<{ checked_in_at: number | null }>();
    if (latest?.checked_in_at)
      return {
        state: "already_checked_in" as const,
        checkedInAt: toIso(latest.checked_in_at),
        displayName: reg.display_name,
      };
    throw err("NOT_FOUND", "That ticket is no longer valid.");
  }
  return {
    state: "checked_in" as const,
    checkedInAt: toIso(now),
    displayName: reg.display_name,
  };
}
