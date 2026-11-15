import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
  await close();
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
