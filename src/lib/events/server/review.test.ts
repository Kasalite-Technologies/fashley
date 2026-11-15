import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/tailor/server/db";
import { createTestDb, seedUser } from "./test-db";
import {
  listDirectory,
  saveEventDraft,
  submitEvent,
  getEventForEditor,
  cancelOwnedEvent,
} from "./events";
import { adminCounts, decideReview, listAdminEvents, setPublication } from "./admin";
import { requireOrganizerForUser, type EventRow, type OrganizerRow } from "./store";
import {
  grantStaffRole,
  listStaff,
  requireStaff,
  revokeStaffRole,
  staffRole,
  audit,
  listAudit,
} from "./authorization";
import { wallClockToUtcMs, utcMsToWallClock } from "./time";
import { createEventsHandlers } from "./http";

let db: Db;
let close: () => Promise<void>;

beforeEach(async () => {
  editorId = null;
  const handle = await createTestDb();
  db = handle.db;
  close = handle.close;
});
afterEach(async () => {
  await close();
});

let editorId: string | null = null;
/** Seeds (once) an events editor and returns the local user id. */
async function reviewer(): Promise<string> {
  if (editorId) return editorId;
  editorId = await seedUser(db, "sub_editor", "editor@example.com");
  // Bootstrap grant: the first operator is granted by themselves, which is the
  // documented owner-approved bootstrap path.
  await grantStaffRole(
    db,
    { userId: editorId, role: "platform_admin" },
    {
      userId: editorId,
      role: "events_editor",
    },
  );
  return editorId;
}

const draft = {
  title: "Accra Fabric Market",
  summary: "Two days of wax print and lace.",
  description: "Bring cash. Tailors welcome.",
  category: "fabric-market" as const,
  format: "in_person" as const,
  city: "Accra",
  country: "Ghana",
  venue: "Trade Centre",
  onlineUrl: "",
  timezone: "Africa/Accra",
  startsAt: "2027-03-05T09:00",
  endsAt: "2027-03-06T17:00",
  registrationOpensAt: "",
  registrationClosesAt: "",
  capacity: "120",
  waitlistEnabled: true,
  accessInfo: "",
  accessibility: "",
  ageLimit: "",
};

async function organizer(): Promise<{ userId: string; org: OrganizerRow }> {
  const userId = await seedUser(db, "sub_org", "organizer@example.com");
  await db
    .prepare(
      "INSERT INTO organizers (id, owner_user_id, slug, name, bio, website, contact_email, city, country, status, version, created_at, updated_at) VALUES ('org_1', ?, 'accra-fashion', 'Accra Fashion', '', NULL, 'organizer@example.com', 'Accra', 'Ghana', 'active', 1, ?, ?)",
    )
    .bind(userId, Date.now(), Date.now())
    .run();
  const org = await requireOrganizerForUser(db, userId);
  return { userId, org };
}

describe("submission and review", () => {
  it("binds an HTTP review decision to the revision the editor opened", async () => {
    const { userId, org } = await organizer();
    const created = await saveEventDraft(db, { userId, organizer: org, input: draft });
    await submitEvent(db, { userId, organizer: org, eventId: created.id });
    await reviewer();
    const handlers = createEventsHandlers({
      db,
      verifier: async () => ({
        subject: "sub_editor",
        displayName: "Editor",
        email: "editor@example.com",
        emailVerified: true,
      }),
    });
    const response = await handlers.adminReview(
      new Request("https://fashley.example/api/admin/events/x/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revisionId: "rev_stale",
          decision: "approved",
          organizerMessage: "",
          internalNote: "",
        }),
      }),
      created.id,
    );
    expect(response.status).toBe(404);
    expect(
      (
        await db
          .prepare("SELECT publication FROM events WHERE id = ?")
          .bind(created.id)
          .first<{ publication: string }>()
      )?.publication,
    ).toBe("unpublished");
  });

  it("rolls back a second decision against the same submitted revision", async () => {
    const { userId, org } = await organizer();
    const created = await saveEventDraft(db, { userId, organizer: org, input: draft });
    await submitEvent(db, { userId, organizer: org, eventId: created.id });
    const editorId = await reviewer();
    const revisionId = created.revisionId;
    const params = {
      actor: { userId: editorId, role: "events_editor" as const },
      eventId: created.id,
      revisionId,
      decision: "approved" as const,
      organizerMessage: "",
      internalNote: "",
    };
    const racingDb: Db = {
      ...db,
      batch: async (statements) => {
        await decideReview(db, params);
        return db.batch(statements);
      },
    };
    await expect(decideReview(racingDb, params)).rejects.toMatchObject({
      code: "REVISION_CONFLICT",
    });
    expect(
      (await db.prepare("SELECT COUNT(*) AS count FROM event_reviews").first<{ count: number }>())
        ?.count,
    ).toBe(1);
  });

  it("does not mutate an approved revision through cover upload", async () => {
    const { userId, org } = await organizer();
    const created = await saveEventDraft(db, { userId, organizer: org, input: draft });
    await submitEvent(db, { userId, organizer: org, eventId: created.id });
    await decideReview(db, {
      actor: { userId: await reviewer(), role: "events_editor" },
      eventId: created.id,
      revisionId: created.revisionId,
      decision: "approved",
      organizerMessage: "",
      internalNote: "",
    });
    let uploaded = false;
    const handlers = createEventsHandlers({
      db,
      verifier: async () => ({
        subject: "sub_org",
        displayName: "Organiser",
        email: "organizer@example.com",
        emailVerified: true,
      }),
      media: {
        putPrivate: async () => {
          uploaded = true;
        },
        getPrivate: async () => new Uint8Array(),
        deletePrivate: async () => {},
      },
    });
    const response = await handlers.uploadCover(
      new Request("https://fashley.example/cover", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: new Uint8Array([255, 216, 255]),
      }),
      created.id,
    );
    expect(response.status).toBe(400);
    expect(uploaded).toBe(false);
  });
  it("keeps an unpublished draft out of the public directory", async () => {
    const { userId, org } = await organizer();
    const created = await saveEventDraft(db, { userId, organizer: org, input: draft });
    expect(created.reviewState).toBe("draft");
    const directory = await listDirectory(db, {
      q: "",
      city: "",
      category: "",
      format: "",
      when: "all",
      page: 1,
    });
    expect(directory.total).toBe(0);
  });

  it("publishes exactly the submitted revision, then serves it publicly", async () => {
    const { userId, org } = await organizer();
    const created = await saveEventDraft(db, { userId, organizer: org, input: draft });
    await submitEvent(db, { userId, organizer: org, eventId: created.id });

    const editorId = await reviewer();
    const row = await db
      .prepare("SELECT * FROM events WHERE id = ?")
      .bind(created.id)
      .first<EventRow>();
    const revision = await db
      .prepare(
        "SELECT id FROM event_revisions WHERE event_id = ? ORDER BY revision_no DESC LIMIT 1",
      )
      .bind(created.id)
      .first<{ id: string }>();

    await decideReview(db, {
      actor: { userId: editorId, role: "events_editor" },
      eventId: created.id,
      revisionId: revision!.id,
      decision: "approved",
      organizerMessage: "",
      internalNote: "Looks good.",
    });

    expect(row?.publication).toBe("unpublished");
    const directory = await listDirectory(db, {
      q: "",
      city: "",
      category: "",
      format: "",
      when: "upcoming",
      page: 1,
    });
    expect(directory.total).toBe(1);
    expect(directory.items[0]?.title).toBe(draft.title);
  });

  it("rejects a stale review so an older revision cannot publish over a newer one", async () => {
    const { userId, org } = await organizer();
    const created = await saveEventDraft(db, { userId, organizer: org, input: draft });
    await submitEvent(db, { userId, organizer: org, eventId: created.id });
    const firstRevision = await db
      .prepare(
        "SELECT id FROM event_revisions WHERE event_id = ? ORDER BY revision_no DESC LIMIT 1",
      )
      .bind(created.id)
      .first<{ id: string }>();

    // Organiser edits after the editor opened the record: revision moves on.
    await db
      .prepare("UPDATE events SET current_revision_id = 'rev_newer' WHERE id = ?")
      .bind(created.id)
      .run();

    await expect(
      decideReview(db, {
        actor: { userId: await reviewer(), role: "events_editor" },
        eventId: created.id,
        revisionId: firstRevision!.id,
        decision: "approved",
        organizerMessage: "",
        internalNote: "",
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });

  it("requires a message when asking for changes", async () => {
    const { userId, org } = await organizer();
    const created = await saveEventDraft(db, { userId, organizer: org, input: draft });
    await submitEvent(db, { userId, organizer: org, eventId: created.id });
    const revision = await db
      .prepare(
        "SELECT id FROM event_revisions WHERE event_id = ? ORDER BY revision_no DESC LIMIT 1",
      )
      .bind(created.id)
      .first<{ id: string }>();
    const detail = await decideReview(db, {
      actor: { userId: await reviewer(), role: "events_editor" },
      eventId: created.id,
      revisionId: revision!.id,
      decision: "changes_requested",
      organizerMessage: "Add the exact venue entrance.",
      internalNote: "",
    });
    expect(detail?.reviewState).toBe("changes_requested");
    const editor = await getEventForEditor(db, org.id, created.id, userId);
    expect(editor.organizerMessage).toBe("Add the exact venue entrance.");
    const directory = await listDirectory(db, {
      q: "",
      city: "",
      category: "",
      format: "",
      when: "all",
      page: 1,
    });
    expect(directory.total).toBe(0);
  });

  it("cancelling notifies every confirmed attendee once", async () => {
    const { userId, org } = await organizer();
    const created = await saveEventDraft(db, { userId, organizer: org, input: draft });
    await submitEvent(db, { userId, organizer: org, eventId: created.id });
    const revision = await db
      .prepare(
        "SELECT id FROM event_revisions WHERE event_id = ? ORDER BY revision_no DESC LIMIT 1",
      )
      .bind(created.id)
      .first<{ id: string }>();
    await decideReview(db, {
      actor: { userId: await reviewer(), role: "events_editor" },
      eventId: created.id,
      revisionId: revision!.id,
      decision: "approved",
      organizerMessage: "",
      internalNote: "",
    });
    const attendee = await seedUser(db, "sub_guest", "guest@example.com");
    await db
      .prepare(
        "INSERT INTO event_registrations (id, event_id, user_id, state, display_name, email, phone, answers_json, revision_id, registered_at, cancelled_at, checked_in_at, version, updated_at) VALUES ('reg_1', ?, ?, 'confirmed', 'Guest', 'guest@example.com', NULL, '{}', ?, ?, NULL, NULL, 1, ?)",
      )
      .bind(created.id, attendee, revision!.id, Date.now(), Date.now())
      .run();

    await cancelOwnedEvent(db, {
      userId,
      organizer: org,
      eventId: created.id,
      reason: "Venue lost.",
    });
    const queued = await db
      .prepare("SELECT kind FROM event_notification_outbox WHERE kind = 'event_cancelled'")
      .all<{ kind: string }>();
    expect(queued.results).toHaveLength(1);
    const row = await db
      .prepare("SELECT lifecycle, registration_closed FROM events WHERE id = ?")
      .bind(created.id)
      .first<{ lifecycle: string; registration_closed: number }>();
    expect(row?.lifecycle).toBe("cancelled");
    expect(row?.registration_closed).toBe(1);
  });
});

describe("admin authorization", () => {
  it("denies admin listing without an active grant", async () => {
    const userId = await seedUser(db, "sub_plain", "plain@example.com");
    expect(await staffRole(db, userId)).toBeNull();
    await expect(requireStaff(db, userId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("applies revocation on the next request", async () => {
    const admin = await seedUser(db, "sub_admin", "admin@example.com");
    await grantStaffRole(
      db,
      { userId: admin, role: "platform_admin" },
      {
        userId: admin,
        role: "events_editor",
      },
    );
    expect(await staffRole(db, admin)).toBe("events_editor");
    const grants = await listStaff(db);
    expect(grants).toHaveLength(1);
    await revokeStaffRole(db, { userId: admin, role: "platform_admin" }, grants[0]!.id);
    expect(await staffRole(db, admin)).toBeNull();
  });

  it("refuses to remove the last platform admin", async () => {
    const admin = await seedUser(db, "sub_admin", "admin@example.com");
    await grantStaffRole(
      db,
      { userId: admin, role: "platform_admin" },
      {
        userId: admin,
        role: "platform_admin",
      },
    );
    const grants = await listStaff(db);
    await expect(
      revokeStaffRole(db, { userId: admin, role: "platform_admin" }, grants[0]!.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await staffRole(db, admin)).toBe("platform_admin");
  });

  it("counts the review queue", async () => {
    const { userId, org } = await organizer();
    const created = await saveEventDraft(db, { userId, organizer: org, input: draft });
    await submitEvent(db, { userId, organizer: org, eventId: created.id });
    const counts = await adminCounts(db);
    expect(counts.needsReview).toBe(1);
    const queue = await listAdminEvents(db, {
      view: "needs_review",
      q: "",
      category: "",
      city: "",
      format: "",
      sort: "updated_at",
      dir: "desc",
      page: 1,
    });
    expect(queue.total).toBe(1);
  });

  it("suspends a published listing without deleting it", async () => {
    const { userId, org } = await organizer();
    const created = await saveEventDraft(db, { userId, organizer: org, input: draft });
    await submitEvent(db, { userId, organizer: org, eventId: created.id });
    const revision = await db
      .prepare(
        "SELECT id FROM event_revisions WHERE event_id = ? ORDER BY revision_no DESC LIMIT 1",
      )
      .bind(created.id)
      .first<{ id: string }>();
    await decideReview(db, {
      actor: { userId: await reviewer(), role: "events_editor" },
      eventId: created.id,
      revisionId: revision!.id,
      decision: "approved",
      organizerMessage: "",
      internalNote: "",
    });
    await setPublication(db, {
      actor: { userId: await reviewer(), role: "events_editor" },
      eventId: created.id,
      action: "suspend",
      reason: "Reported for a wrong venue.",
    });
    const directory = await listDirectory(db, {
      q: "",
      city: "",
      category: "",
      format: "",
      when: "all",
      page: 1,
    });
    expect(directory.total).toBe(0);
    const still = await db
      .prepare("SELECT publication FROM events WHERE id = ?")
      .bind(created.id)
      .first<{ publication: string }>();
    expect(still?.publication).toBe("suspended");
    const auditRows = await listAudit(db);
    expect(auditRows.some((r) => r.action === "event.suspend")).toBe(true);
  });

  it("writes audit entries without attendee data", async () => {
    await audit(db, null, "test.action", "event", "evt_x", { reason: "checked" });
    const rows = await listAudit(db);
    expect(rows[0]?.summary).toEqual({ reason: "checked" });
  });
});

describe("time zone handling", () => {
  it("round-trips a wall clock time in a fixed-offset zone", () => {
    const utc = wallClockToUtcMs("2027-03-05T09:00", "Africa/Accra");
    expect(new Date(utc).toISOString()).toBe("2027-03-05T09:00:00.000Z");
    expect(utcMsToWallClock(utc, "Africa/Accra")).toBe("2027-03-05T09:00");
  });

  it("applies daylight saving for a zone that observes it", () => {
    const summer = wallClockToUtcMs("2027-07-01T12:00", "Europe/London");
    expect(new Date(summer).toISOString()).toBe("2027-07-01T11:00:00.000Z");
    const winter = wallClockToUtcMs("2027-01-01T12:00", "Europe/London");
    expect(new Date(winter).toISOString()).toBe("2027-01-01T12:00:00.000Z");
  });

  it("rejects a wall clock time skipped by spring forward", () => {
    expect(() => wallClockToUtcMs("2027-03-28T01:30", "Europe/London")).toThrowError(
      /does not exist/,
    );
  });

  it("rejects an unknown timezone instead of guessing", () => {
    expect(() => wallClockToUtcMs("2027-03-05T09:00", "Mars/Olympus")).toThrowError(
      /not recognised/,
    );
  });
});

describe("live listing stays stable while a change is reviewed", () => {
  it("keeps the approved snapshot public during a pending edit", async () => {
    const { userId, org } = await organizer();
    const created = await saveEventDraft(db, { userId, organizer: org, input: draft });
    await submitEvent(db, { userId, organizer: org, eventId: created.id });
    const revision = await db
      .prepare(
        "SELECT id FROM event_revisions WHERE event_id = ? ORDER BY revision_no DESC LIMIT 1",
      )
      .bind(created.id)
      .first<{ id: string }>();
    const editorId = await reviewer();
    await decideReview(db, {
      actor: { userId: editorId, role: "events_editor" },
      eventId: created.id,
      revisionId: revision!.id,
      decision: "approved",
      organizerMessage: "",
      internalNote: "",
    });

    await saveEventDraft(db, {
      userId,
      organizer: org,
      eventId: created.id,
      input: { ...draft, title: "Accra Fabric Market 2027", city: "Kumasi" },
    });

    const directory = await listDirectory(db, {
      q: "",
      city: "",
      category: "",
      format: "",
      when: "upcoming",
      page: 1,
    });
    expect(directory.items[0]?.title).toBe("Accra Fabric Market");
    expect(directory.items[0]?.city).toBe("Accra");

    const before = await db
      .prepare("SELECT * FROM events WHERE id = ?")
      .bind(created.id)
      .first<EventRow>();
    expect(before?.review_state).toBe("draft");
    expect(before?.publication).toBe("published");
    expect(before?.approved_revision_no).toBe(1);

    // Submitting the replacement keeps revision 1 approved and live.
    await submitEvent(db, { userId, organizer: org, eventId: created.id });
    const after = await db
      .prepare("SELECT * FROM events WHERE id = ?")
      .bind(created.id)
      .first<EventRow>();
    expect(after?.approved_revision_no).toBe(1);
    expect(after?.title).toBe("Accra Fabric Market");
    const revisions = await db
      .prepare(
        "SELECT review_state, revision_no FROM event_revisions WHERE event_id = ? ORDER BY revision_no",
      )
      .bind(created.id)
      .all<{ review_state: string; revision_no: number }>();
    expect(revisions.results).toEqual([
      { review_state: "approved", revision_no: 1 },
      { review_state: "submitted", revision_no: 2 },
    ]);
  });
});

describe("review races", () => {
  it("rolls back the whole review when the revision pointer moved", async () => {
    const { userId, org } = await organizer();
    const created = await saveEventDraft(db, { userId, organizer: org, input: draft });
    await submitEvent(db, { userId, organizer: org, eventId: created.id });
    const revision = await db
      .prepare(
        "SELECT id FROM event_revisions WHERE event_id = ? ORDER BY revision_no DESC LIMIT 1",
      )
      .bind(created.id)
      .first<{ id: string }>();
    const editorId = await reviewer();

    // Simulate the organiser replacing the revision while the editor's panel
    // still shows the previous one.
    await db
      .prepare("UPDATE events SET current_revision_id = 'rev_newer' WHERE id = ?")
      .bind(created.id)
      .run();

    await expect(
      decideReview(db, {
        actor: { userId: editorId, role: "events_editor" },
        eventId: created.id,
        revisionId: revision!.id,
        decision: "approved",
        organizerMessage: "",
        internalNote: "",
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });

    const reviews = await db
      .prepare("SELECT COUNT(*) AS count FROM event_reviews")
      .first<{ count: number }>();
    expect(reviews?.count).toBe(0);
    const event = await db
      .prepare("SELECT publication, review_state FROM events WHERE id = ?")
      .bind(created.id)
      .first<{ publication: string; review_state: string }>();
    expect(event?.publication).toBe("unpublished");
    expect(event?.review_state).toBe("submitted");
    const emails = await db
      .prepare("SELECT COUNT(*) AS count FROM event_notification_outbox WHERE kind = 'published'")
      .first<{ count: number }>();
    expect(emails?.count).toBe(0);
  });
});

describe("cover changes cannot bypass review", () => {
  it("writes the cover to the revision, not the live snapshot", async () => {
    const { userId, org } = await organizer();
    const created = await saveEventDraft(db, { userId, organizer: org, input: draft });
    await submitEvent(db, { userId, organizer: org, eventId: created.id });
    const revision = await db
      .prepare(
        "SELECT id FROM event_revisions WHERE event_id = ? ORDER BY revision_no DESC LIMIT 1",
      )
      .bind(created.id)
      .first<{ id: string }>();
    const editorId = await reviewer();
    await decideReview(db, {
      actor: { userId: editorId, role: "events_editor" },
      eventId: created.id,
      revisionId: revision!.id,
      decision: "approved",
      organizerMessage: "",
      internalNote: "",
    });

    // Simulate the organisation replacing the cover via the revision write path
    // used by the upload endpoint while a new draft is pending.
    await saveEventDraft(db, { userId, organizer: org, eventId: created.id, input: draft });
    await db
      .prepare(
        "UPDATE event_revisions SET cover_object_key = 'events/x/new.jpg' WHERE id = (SELECT current_revision_id FROM events WHERE id = ?)",
      )
      .bind(created.id)
      .run();

    const live = await db
      .prepare("SELECT cover_object_key, approved_revision_id FROM events WHERE id = ?")
      .bind(created.id)
      .first<{ cover_object_key: string | null; approved_revision_id: string }>();
    expect(live?.approved_revision_id).toBe(revision!.id);
    expect(live?.cover_object_key).toBeNull();
  });
});
