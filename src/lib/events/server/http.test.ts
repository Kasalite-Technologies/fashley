import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/tailor/server/db";
import { createTestDb } from "./test-db";
import { createEventsHandlers } from "./http";

let db: Db;
let close: () => Promise<void>;
beforeEach(async () => {
  const handle = await createTestDb();
  db = handle.db;
  close = handle.close;
});
afterEach(async () => {
  vi.restoreAllMocks();
  await close();
});

describe("anonymous report containment", () => {
  beforeEach(async () => {
    await db.exec(`
      INSERT INTO app_users (id, status, created_at, updated_at)
        VALUES ('report_owner', 'active', 1, 1);
      INSERT INTO organizers (id, owner_user_id, slug, name, contact_email, status, created_at, updated_at)
        VALUES ('report_org', 'report_owner', 'report-org', 'Test organiser', 'test@example.com', 'active', 1, 1);
      INSERT INTO events (id, slug, organizer_id, organizer_name, publication, review_state, lifecycle,
        title, category, format, starts_at, ends_at, created_at, updated_at)
        VALUES ('report_event', 'test-event', 'report_org', 'Test organiser', 'published', 'approved',
        'scheduled', 'Test event', 'fashion-show', 'in_person', 1, 2, 1, 1),
        ('report_event_2', 'other-event', 'report_org', 'Test organiser', 'published', 'approved',
        'scheduled', 'Other event', 'fashion-show', 'in_person', 1, 2, 1, 1);
    `);
  });

  function request(headers: Record<string, string> = {}, body?: string) {
    return new Request("https://fashley.example/api/events/test-event/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1", ...headers },
      body: body ?? JSON.stringify({ reason: "other", detail: "Test report" }),
    });
  }

  async function reportCount() {
    return (
      await db.prepare("SELECT COUNT(*) AS count FROM event_reports").first<{ count: number }>()
    )?.count;
  }

  it("bounds concurrent anonymous writes and returns a non-cacheable 429", async () => {
    const handlers = createEventsHandlers({ db });
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => handlers.report(request(), "test-event")),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(5);
    expect(responses.filter((r) => r.status === 429)).toHaveLength(15);
    expect(await reportCount()).toBe(5);
    const blocked = responses.find((r) => r.status === 429)!;
    expect(blocked.headers.get("Cache-Control")).toBe("no-store");
    expect(await blocked.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
    const bucket = await db
      .prepare("SELECT bucket_key_hash, attempt_count FROM event_report_rate_limits")
      .first<{ bucket_key_hash: string; attempt_count: number }>();
    expect(bucket?.bucket_key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(bucket?.attempt_count).toBe(5);
  });

  it("shares the quota across slugs, claimed emails, forwarded headers and handler instances", async () => {
    for (let i = 0; i < 5; i++) {
      const response = await createEventsHandlers({ db }).report(
        request(
          { "X-Forwarded-For": `198.51.100.${i}` },
          JSON.stringify({ reason: "other", reporterEmail: `reporter${i}@example.com` }),
        ),
        i % 2 ? "other-event" : "test-event",
      );
      expect(response.status).toBe(201);
    }
    expect((await createEventsHandlers({ db }).report(request(), "other-event")).status).toBe(429);
    expect(await reportCount()).toBe(5);
    expect(
      (
        await createEventsHandlers({ db }).report(
          request({ "CF-Connecting-IP": "192.0.2.2" }),
          "test-event",
        )
      ).status,
    ).toBe(201);
  });

  it("does not extend the window on rejected attempts and resets at the exact boundary", async () => {
    const start = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(start);
    const handlers = createEventsHandlers({ db });
    for (let i = 0; i < 5; i++)
      expect((await handlers.report(request(), "test-event")).status).toBe(201);
    clock.mockReturnValue(start + 599_999);
    expect((await handlers.report(request(), "test-event")).status).toBe(429);
    clock.mockReturnValue(start + 600_000);
    expect((await handlers.report(request(), "test-event")).status).toBe(201);
    expect(await reportCount()).toBe(6);
  });

  it("counts malformed and unknown-event attempts before parsing or looking up the slug", async () => {
    const handlers = createEventsHandlers({ db });
    for (let i = 0; i < 4; i++)
      expect((await handlers.report(request({}, "not json"), "test-event")).status).toBe(400);
    expect((await handlers.report(request(), "unknown-event")).status).toBe(404);
    expect((await handlers.report(request(), "test-event")).status).toBe(429);
    expect(await reportCount()).toBe(0);
  });

  it("fails closed without the trusted caller header, ignoring spoofable alternatives", async () => {
    const handlers = createEventsHandlers({ db });
    for (const ip of ["", " ", "x".repeat(65)]) {
      const response = await handlers.report(
        request({
          "CF-Connecting-IP": ip,
          "X-Forwarded-For": "192.0.2.1",
          "X-Real-IP": "192.0.2.1",
        }),
        "test-event",
      );
      expect(response.status).toBe(503);
    }
    const missing = request();
    missing.headers.delete("CF-Connecting-IP");
    expect((await handlers.report(missing, "test-event")).status).toBe(503);
    expect(await reportCount()).toBe(0);
  });

  it("bounds expired-counter cleanup while preserving active quotas", async () => {
    const start = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(start);
    const handlers = createEventsHandlers({ db });
    for (let i = 0; i < 5; i++)
      expect((await handlers.report(request(), "test-event")).status).toBe(201);
    for (let i = 0; i < 101; i++) {
      await db
        .prepare(
          "INSERT INTO event_report_rate_limits (bucket_key_hash, window_start, attempt_count) VALUES (?, ?, 5)",
        )
        .bind(`expired_${i}`, start - 1)
        .run();
    }
    clock.mockReturnValue(start + 600_000);
    // The caller's expired row is outside the first 100 cleaned up; the UPSERT
    // must still reset it atomically rather than relying on cleanup for expiry.
    expect((await handlers.report(request(), "test-event")).status).toBe(201);
    expect(
      (
        await db
          .prepare("SELECT COUNT(*) AS count FROM event_report_rate_limits")
          .first<{ count: number }>()
      )?.count,
    ).toBe(2);
    for (let i = 0; i < 4; i++)
      expect((await handlers.report(request(), "test-event")).status).toBe(201);
    expect((await handlers.report(request(), "test-event")).status).toBe(429);
    expect(
      (
        await db
          .prepare("SELECT COUNT(*) AS count FROM event_report_rate_limits")
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
  });
});

describe("events HTTP trust boundaries", () => {
  for (const emailVerified of [false, undefined]) {
    it(`requires explicit email verification (${String(emailVerified)})`, async () => {
      const handlers = createEventsHandlers({
        db,
        verifier: async () => ({
          subject: "unverified",
          displayName: "Guest",
          email: "guest@example.com",
          ...(emailVerified === undefined ? {} : { emailVerified }),
        }),
      });
      const response = await handlers.saveOrganizer(
        new Request("https://fashley.example/profile", { method: "PUT" }),
      );
      expect(response.status).toBe(403);
      expect(
        (await db.prepare("SELECT COUNT(*) AS count FROM user_emails").first<{ count: number }>())
          ?.count,
      ).toBe(0);
    });
  }

  it("rejects cross-site cookie-authenticated mutations before provisioning an identity", async () => {
    const handlers = createEventsHandlers({
      db,
      verifier: async () => ({
        subject: "guest",
        displayName: "Guest",
        email: "guest@example.com",
        emailVerified: true,
      }),
    });
    const response = await handlers.saveOrganizer(
      new Request("https://fashley.example/profile", {
        method: "PUT",
        headers: { Origin: "https://attacker.example", Cookie: "__session=dummy" },
      }),
    );
    expect(response.status).toBe(403);
    expect(
      (await db.prepare("SELECT COUNT(*) AS count FROM auth_identities").first<{ count: number }>())
        ?.count,
    ).toBe(0);
  });
});
