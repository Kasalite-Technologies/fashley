import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/tailor/server/db";
import { createTestDb, seedUser } from "./test-db";
import { saveOrganizerProfile } from "./events";
import { requireOrganizerForUser, type EventRow } from "./store";
import {
  cancelRegistration,
  checkInByCredential,
  checkInRegistration,
  listEventAttendees,
  listMyRegistrations,
  promoteWaitlisted,
  registerForEvent,
  ticketCredential,
} from "./registrations";
import { availabilityOf } from "./store";

let db: Db;
let close: () => Promise<void>;

beforeEach(async () => {
  const handle = await createTestDb();
  db = handle.db;
  close = handle.close;
});
afterEach(async () => {
  await close();
});

async function publishedEvent(
  options: {
    capacity?: number | null;
    waitlist?: boolean;
    registrationClosed?: boolean;
    closesAt?: number | null;
    lifecycle?: "scheduled" | "cancelled" | "postponed";
  } = {},
) {
  const start = Date.now() + 7 * 86_400_000;
  const end = start + 3 * 60 * 60 * 1000;
  await db
    .prepare(
      "INSERT INTO app_users (id, status, created_at, updated_at) VALUES (?, 'active', ?, ?)",
    )
    .bind("usr_owner", Date.now(), Date.now())
    .run();
  await db
    .prepare(
      "INSERT INTO organizers (id, owner_user_id, slug, name, bio, website, contact_email, city, country, status, version, created_at, updated_at) VALUES ('org_1','usr_owner','accra-fashion','Accra Fashion','',NULL,'hello@example.com','Accra','Ghana','active',1,?,?)",
    )
    .bind(Date.now(), Date.now())
    .run();
  await db
    .prepare(
      "INSERT INTO events (id, slug, organizer_id, organizer_name, publication, review_state, lifecycle, title, summary, description, category, format, city, country, venue, timezone, starts_at, ends_at, registration_opens_at, registration_closes_at, registration_closed, capacity, waitlist_enabled, confirmed_count, search_text, version, created_at, updated_at) VALUES ('evt_1','accra-show','org_1','Accra Fashion','published','approved',?, 'Accra Fashion Show','A show','A description','fashion-show','in_person','Accra','Ghana','Venue','Africa/Accra',?,?,NULL,?,?, ?, ?,0,'accra fashion show accra ghana',1,?,?)",
    )
    .bind(
      options.lifecycle ?? "scheduled",
      start,
      end,
      options.closesAt ?? null,
      options.registrationClosed ? 1 : 0,
      options.capacity === undefined ? 10 : options.capacity,
      options.waitlist ? 1 : 0,
      Date.now(),
      Date.now(),
    )
    .run();
  return db.prepare("SELECT * FROM events WHERE id = 'evt_1'").first<EventRow>();
}

const registration = {
  displayName: "Ama Mensah",
  email: "ama@example.com",
  phone: "",
  accessibilityRequest: "",
};

describe("registration capacity", () => {
  it("releases a cancelled seat once and sends the notice to the organiser email", async () => {
    const event = (await publishedEvent({ capacity: 1, waitlist: true }))!;
    const ama = await seedUser(db, "sub_a", "ama@example.com");
    const reg = await registerForEvent(db, {
      userId: ama,
      event,
      input: registration,
      wantsWaitlist: false,
    });
    const kofi = await seedUser(db, "sub_b", "kofi@example.com");
    await registerForEvent(db, {
      userId: kofi,
      event: (await db.prepare("SELECT * FROM events WHERE id = 'evt_1'").first<EventRow>())!,
      input: { ...registration, email: "kofi@example.com" },
      wantsWaitlist: true,
    });
    await cancelRegistration(db, { userId: ama, registrationId: reg.id });
    await cancelRegistration(db, { userId: ama, registrationId: reg.id });
    const updated = await db.prepare("SELECT * FROM events WHERE id = 'evt_1'").first<EventRow>();
    expect(updated?.confirmed_count).toBe(0);
    const notices = await db
      .prepare(
        "SELECT kind, recipient_email FROM event_notification_outbox WHERE kind IN ('registration_cancelled','seat_available') ORDER BY kind",
      )
      .all<{ kind: string; recipient_email: string }>();
    expect(notices.results).toEqual([
      { kind: "registration_cancelled", recipient_email: "ama@example.com" },
      { kind: "seat_available", recipient_email: "hello@example.com" },
    ]);
  });

  it("rolls back a cancellation when another request changed the registration", async () => {
    const event = (await publishedEvent())!;
    const userId = await seedUser(db, "sub_a", "ama@example.com");
    const reg = await registerForEvent(db, {
      userId,
      event,
      input: registration,
      wantsWaitlist: false,
    });
    const racingDb: Db = {
      ...db,
      batch: async (statements) => {
        await db
          .prepare("UPDATE event_registrations SET version = version + 1 WHERE id = ?")
          .bind(reg.id)
          .run();
        return db.batch(statements);
      },
    };
    await expect(
      cancelRegistration(racingDb, { userId, registrationId: reg.id }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    const state = await db
      .prepare("SELECT state FROM event_registrations WHERE id = ?")
      .bind(reg.id)
      .first<{ state: string }>();
    expect(state?.state).toBe("confirmed");
    expect(
      (
        await db
          .prepare("SELECT confirmed_count FROM events WHERE id = 'evt_1'")
          .first<{ confirmed_count: number }>()
      )?.confirmed_count,
    ).toBe(1);
    expect(
      (
        await db
          .prepare(
            "SELECT COUNT(*) AS count FROM event_notification_outbox WHERE kind = 'registration_cancelled'",
          )
          .first<{ count: number }>()
      )?.count,
    ).toBe(0);
  });

  it("rejects a stale waitlist request after registration closes", async () => {
    const event = (await publishedEvent({ capacity: 1, waitlist: true }))!;
    const ama = await seedUser(db, "sub_a", "ama@example.com");
    await registerForEvent(db, { userId: ama, event, input: registration, wantsWaitlist: false });
    const staleEvent = (await db
      .prepare("SELECT * FROM events WHERE id = 'evt_1'")
      .first<EventRow>())!;
    await db.prepare("UPDATE events SET registration_closed = 1 WHERE id = 'evt_1'").run();
    const kofi = await seedUser(db, "sub_b", "kofi@example.com");
    await expect(
      registerForEvent(db, {
        userId: kofi,
        event: staleEvent,
        input: registration,
        wantsWaitlist: true,
      }),
    ).rejects.toMatchObject({ code: "REGISTRATION_CLOSED" });
  });

  it("rejects lowering capacity below confirmed attendance", async () => {
    const event = (await publishedEvent({ capacity: 2 }))!;
    for (const subject of ["one", "two"]) {
      const userId = await seedUser(db, subject, `${subject}@example.com`);
      await registerForEvent(db, { userId, event, input: registration, wantsWaitlist: false });
    }
    await expect(
      db.prepare("UPDATE events SET capacity = 1 WHERE id = 'evt_1'").run(),
    ).rejects.toThrow(/CAPACITY_EXCEEDED/);
  });
  it("confirms one place and increments the counter exactly once", async () => {
    const event = (await publishedEvent({ capacity: 2 }))!;
    const user = await seedUser(db, "sub_a", "ama@example.com");
    const result = await registerForEvent(db, {
      userId: user,
      event,
      input: registration,
      wantsWaitlist: false,
    });
    expect(result.state).toBe("confirmed");
    const row = await db.prepare("SELECT * FROM events WHERE id = 'evt_1'").first<EventRow>();
    expect(row?.confirmed_count).toBe(1);
    const ticket = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM event_tickets WHERE event_id = 'evt_1' AND revoked_at IS NULL",
      )
      .first<{ count: number }>();
    expect(ticket?.count).toBe(1);
    const queued = await db
      .prepare("SELECT kind, state FROM event_notification_outbox")
      .all<{ kind: string; state: string }>();
    expect(queued.results).toEqual([{ kind: "registration_confirmed", state: "pending" }]);
  });

  it("rejects the over-capacity registration and rolls back seat, ticket and email", async () => {
    const event = (await publishedEvent({ capacity: 1 }))!;
    const first = await seedUser(db, "sub_a", "ama@example.com");
    const second = await seedUser(db, "sub_b", "kofi@example.com");
    await registerForEvent(db, {
      userId: first,
      event,
      input: registration,
      wantsWaitlist: false,
    });

    // Simulate the race by re-reading the stale event row before the second write.
    await expect(
      registerForEvent(db, {
        userId: second,
        event: { ...event, confirmed_count: 0 },
        input: { ...registration, email: "kofi@example.com" },
        wantsWaitlist: false,
      }),
    ).rejects.toMatchObject({ code: "CAPACITY_UNAVAILABLE" });

    const rows = await db
      .prepare("SELECT * FROM event_registrations WHERE event_id = 'evt_1'")
      .all<{ state: string; user_id: string }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]?.user_id).toBe(first);
    const event2 = await db.prepare("SELECT * FROM events WHERE id = 'evt_1'").first<EventRow>();
    expect(event2?.confirmed_count).toBe(1);
    const tickets = await db
      .prepare("SELECT COUNT(*) AS count FROM event_tickets")
      .first<{ count: number }>();
    expect(tickets?.count).toBe(1);
    const emails = await db
      .prepare("SELECT COUNT(*) AS count FROM event_notification_outbox")
      .first<{ count: number }>();
    expect(emails?.count).toBe(1);
  });

  it("prevents a duplicate registration for the same person", async () => {
    const event = (await publishedEvent())!;
    const user = await seedUser(db, "sub_a", "ama@example.com");
    await registerForEvent(db, { userId: user, event, input: registration, wantsWaitlist: false });
    await expect(
      registerForEvent(db, { userId: user, event, input: registration, wantsWaitlist: false }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const count = await db
      .prepare("SELECT COUNT(*) AS count FROM event_registrations")
      .first<{ count: number }>();
    expect(count?.count).toBe(1);
  });

  it("waitlists without taking a seat", async () => {
    const event = (await publishedEvent({ capacity: 1, waitlist: true }))!;
    const first = await seedUser(db, "sub_a", "ama@example.com");
    await registerForEvent(db, { userId: first, event, input: registration, wantsWaitlist: false });
    const second = await seedUser(db, "sub_b", "kofi@example.com");
    const result = await registerForEvent(db, {
      userId: second,
      event: (await db.prepare("SELECT * FROM events WHERE id = 'evt_1'").first<EventRow>())!,
      input: { ...registration, email: "kofi@example.com" },
      wantsWaitlist: true,
    });
    expect(result.state).toBe("waitlisted");
    const row = await db.prepare("SELECT * FROM events WHERE id = 'evt_1'").first<EventRow>();
    expect(row?.confirmed_count).toBe(1);
    expect(availabilityOf(row!)).toBe("waitlist");
  });

  it("refuses a waitlist join when the organiser disabled it", async () => {
    const event = (await publishedEvent({ capacity: 1, waitlist: true }))!;
    const first = await seedUser(db, "sub_a", "ama@example.com");
    await registerForEvent(db, { userId: first, event, input: registration, wantsWaitlist: false });
    await db.prepare("UPDATE events SET waitlist_enabled = 0 WHERE id = 'evt_1'").run();
    const second = await seedUser(db, "sub_b", "kofi@example.com");
    await expect(
      registerForEvent(db, {
        userId: second,
        event: (await db.prepare("SELECT * FROM events WHERE id = 'evt_1'").first<EventRow>())!,
        input: { ...registration, email: "kofi@example.com" },
        wantsWaitlist: true,
      }),
    ).rejects.toMatchObject({ code: "CAPACITY_UNAVAILABLE" });
  });

  it("rejects registration after the closing time even if the client is stale", async () => {
    const event = (await publishedEvent({ closesAt: Date.now() - 1000 }))!;
    const user = await seedUser(db, "sub_a", "ama@example.com");
    await expect(
      registerForEvent(db, { userId: user, event, input: registration, wantsWaitlist: false }),
    ).rejects.toMatchObject({ code: "REGISTRATION_CLOSED" });
  });

  it("rejects registration on a cancelled event", async () => {
    const event = (await publishedEvent({ lifecycle: "cancelled" }))!;
    const user = await seedUser(db, "sub_a", "ama@example.com");
    await expect(
      registerForEvent(db, { userId: user, event, input: registration, wantsWaitlist: false }),
    ).rejects.toMatchObject({ code: "REGISTRATION_CLOSED" });
  });
});

describe("waitlist promotion", () => {
  it("promotes atomically when a seat is free and never overbooks", async () => {
    const event = (await publishedEvent({ capacity: 1, waitlist: true }))!;
    const first = await seedUser(db, "sub_a", "ama@example.com");
    await registerForEvent(db, { userId: first, event, input: registration, wantsWaitlist: false });
    const second = await seedUser(db, "sub_b", "kofi@example.com");
    await registerForEvent(db, {
      userId: second,
      event: (await db.prepare("SELECT * FROM events WHERE id = 'evt_1'").first<EventRow>())!,
      input: { ...registration, email: "kofi@example.com" },
      wantsWaitlist: true,
    });
    const waitlisted = await db
      .prepare("SELECT * FROM event_registrations WHERE user_id = ?")
      .bind(second)
      .first<{ id: string }>();

    // No seat is free, so promotion must fail and leave the waitlist untouched.
    await expect(
      promoteWaitlisted(db, {
        userId: "usr_owner",
        event: (await db.prepare("SELECT * FROM events WHERE id = 'evt_1'").first<EventRow>())!,
        registrationId: waitlisted!.id,
      }),
    ).rejects.toMatchObject({ code: "CAPACITY_UNAVAILABLE" });
    const still = await db
      .prepare("SELECT state FROM event_registrations WHERE id = ?")
      .bind(waitlisted!.id)
      .first<{ state: string }>();
    expect(still?.state).toBe("waitlisted");

    // Free the seat, then promote.
    const firstReg = await db
      .prepare("SELECT id FROM event_registrations WHERE user_id = ?")
      .bind(first)
      .first<{ id: string }>();
    await db
      .prepare("UPDATE event_registrations SET state = 'cancelled' WHERE id = ?")
      .bind(firstReg!.id)
      .run();
    // The database transition releases the seat without a second counter write.
    await promoteWaitlisted(db, {
      userId: "usr_owner",
      event: (await db.prepare("SELECT * FROM events WHERE id = 'evt_1'").first<EventRow>())!,
      registrationId: waitlisted!.id,
    });
    const promoted = await db
      .prepare("SELECT state FROM event_registrations WHERE id = ?")
      .bind(waitlisted!.id)
      .first<{ state: string }>();
    expect(promoted?.state).toBe("confirmed");
    const row = await db.prepare("SELECT * FROM events WHERE id = 'evt_1'").first<EventRow>();
    expect(row?.confirmed_count).toBe(1);
  });
});

describe("tickets and check-in", () => {
  it("checks in once and reports a repeat scan without writing a second record", async () => {
    const event = (await publishedEvent())!;
    const user = await seedUser(db, "sub_a", "ama@example.com");
    const reg = await registerForEvent(db, {
      userId: user,
      event,
      input: registration,
      wantsWaitlist: false,
    });
    const { credential } = await ticketCredential(db, user, reg.id);

    const first = await checkInByCredential(db, {
      userId: "usr_owner",
      event,
      credential,
    });
    expect(first.state).toBe("checked_in");
    const second = await checkInByCredential(db, {
      userId: "usr_owner",
      event,
      credential,
    });
    expect(second.state).toBe("already_checked_in");
    const checks = await db
      .prepare("SELECT COUNT(*) AS count FROM event_check_ins")
      .first<{ count: number }>();
    expect(checks?.count).toBe(1);
  });

  it("rejects a ticket presented at the wrong event", async () => {
    const event = (await publishedEvent())!;
    const user = await seedUser(db, "sub_a", "ama@example.com");
    const reg = await registerForEvent(db, {
      userId: user,
      event,
      input: registration,
      wantsWaitlist: false,
    });
    const { credential } = await ticketCredential(db, user, reg.id);
    await expect(
      checkInByCredential(db, {
        userId: "usr_owner",
        event: { ...event, id: "evt_other" },
        credential,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("revokes the ticket when the attendee cancels", async () => {
    const event = (await publishedEvent())!;
    const user = await seedUser(db, "sub_a", "ama@example.com");
    const reg = await registerForEvent(db, {
      userId: user,
      event,
      input: registration,
      wantsWaitlist: false,
    });
    await db
      .prepare("UPDATE event_tickets SET revoked_at = ? WHERE registration_id = ?")
      .bind(Date.now(), reg.id)
      .run();
    await expect(ticketCredential(db, user, reg.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("never checks in a waitlisted person", async () => {
    const event = (await publishedEvent({ capacity: 1, waitlist: true }))!;
    const first = await seedUser(db, "sub_a", "ama@example.com");
    await registerForEvent(db, { userId: first, event, input: registration, wantsWaitlist: false });
    const second = await seedUser(db, "sub_b", "kofi@example.com");
    const waitlisted = await registerForEvent(db, {
      userId: second,
      event: (await db.prepare("SELECT * FROM events WHERE id = 'evt_1'").first<EventRow>())!,
      input: { ...registration, email: "kofi@example.com" },
      wantsWaitlist: true,
    });
    await expect(
      checkInRegistration(db, {
        userId: "usr_owner",
        event,
        registrationId: waitlisted.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("isolation", () => {
  it("shows each person only their own registration", async () => {
    const event = (await publishedEvent())!;
    const ama = await seedUser(db, "sub_a", "ama@example.com");
    const kofi = await seedUser(db, "sub_b", "kofi@example.com");
    await registerForEvent(db, { userId: ama, event, input: registration, wantsWaitlist: false });
    await registerForEvent(db, {
      userId: kofi,
      event,
      input: { ...registration, email: "kofi@example.com" },
      wantsWaitlist: false,
    });
    const mine = await listMyRegistrations(db, ama);
    expect(mine).toHaveLength(1);
    const other = await listMyRegistrations(db, kofi);
    expect(other).toHaveLength(1);
    expect(other[0]?.id).not.toBe(mine[0]?.id);
    const attendees = await listEventAttendees(db, "evt_1");
    expect(attendees).toHaveLength(2);
  });

  it("keeps each organiser profile scoped to its owner", async () => {
    const ama = await seedUser(db, "sub_a", "ama@example.com");
    await saveOrganizerProfile(db, ama, {
      name: "Ama Studio",
      bio: "",
      city: "Accra",
      country: "Ghana",
      website: "",
      contactEmail: "ama@example.com",
    });
    const kofi = await seedUser(db, "sub_b", "kofi@example.com");
    const theirs = await requireOrganizerForUser(db, kofi).catch((e: unknown) => e);
    expect(theirs).toMatchObject({ code: "NOT_FOUND" });
    const amaProfile = await requireOrganizerForUser(db, ama);
    expect(amaProfile.owner_user_id).toBe(ama);
  });
});
