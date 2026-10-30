import { describe, expect, it, vi } from "vitest";
import {
  briefSchema,
  fixtureBrief,
  fixtureRedactedBriefNoMeasurements,
  meResponseSchema,
  projectDetailSchema,
  redactedBriefSchema,
  templateDetailSchema,
} from "@/lib/tailor/contracts";
import { createFixtureTailorApi } from "./fixtures";
import { createHttpTailorApi } from "./http";
import { fixturesEnabled, resolveTailorApi } from "./index";
import { IdempotencyKeyKeeper, newIdempotencyKey, tailorKeys } from "./keys";
import { TailorApiError } from "./errors";

// All evidence in this file is fixture evidence from synthetic contract
// fixtures F01 to F16. It is not live-backend evidence.
describe("fixture adapter (fixture evidence)", () => {
  it("returns schema-valid payloads", async () => {
    const api = createFixtureTailorApi();
    expect(meResponseSchema.safeParse(await api.me()).success).toBe(true);
    expect(templateDetailSchema.safeParse(await api.getTemplate("tpl_fixture_dress")).success).toBe(
      true,
    );
    expect(projectDetailSchema.safeParse(await api.getProject("prj_fixture_1")).success).toBe(true);
    expect(briefSchema.safeParse(await api.getBrief("brf_fixture_1")).success).toBe(true);
    const session = await (async () => {
      await api.reviewExchange({ token: "synthetic-fixture-token-0001" });
      return api.reviewSession();
    })();
    expect(redactedBriefSchema.safeParse(session.brief).success).toBe(true);
    expect(session.brief.measurements).toBeNull();
  });

  it("rejects an unknown project as NOT_FOUND (F13 behaviour)", async () => {
    const api = createFixtureTailorApi();
    await expect(api.getProject("prj_other_user")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("surfaces a draft conflict instead of overwriting (F09)", async () => {
    const api = createFixtureTailorApi();
    const detail = await api.getProject("prj_fixture_1");
    await expect(
      api.patchDraft("prj_fixture_1", {
        expectedDraftVersion: detail.draft.version + 5,
        input: detail.draft.input,
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });

  it("does not allow verify or accept actions on a measurements-free share (F10/F15)", async () => {
    const api = createFixtureTailorApi();
    await api.reviewExchange({ token: "synthetic-fixture-token-0001" });
    await expect(
      api.reviewAction(
        {
          briefId: fixtureBrief.id,
          expectedContentHash: fixtureBrief.contentHash,
          action: "verify_measurements",
          reviewerName: "Fixture Reviewer",
          verifications: [
            { measurementId: "msr_fixture_bust", valueMm: 920, method: "in_person_tape" },
          ],
        },
        "review-verify-fixture-0001",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fixtureRedactedBriefNoMeasurements.measurements).toBeNull();
  });
});

describe("query keys and idempotency", () => {
  it("never puts a review token or PIN in a query key", () => {
    const keys = JSON.stringify([
      tailorKeys.me(),
      tailorKeys.projects("usr_1", { query: "dress" }),
      tailorKeys.project("usr_1", "prj_1"),
      tailorKeys.reviewSession(),
    ]);
    expect(keys).not.toContain("synthetic-fixture-token");
    expect(keys.toLowerCase()).not.toContain("pin");
    expect(keys).toContain("usr_1");
  });

  it("reuses one key per deliberate mutation until cleared", () => {
    const keeper = new IdempotencyKeyKeeper();
    const first = keeper.keyFor("create-project");
    expect(keeper.keyFor("create-project")).toBe(first);
    keeper.clear("create-project");
    expect(keeper.keyFor("create-project")).not.toBe(first);
    expect(newIdempotencyKey("create-share").length).toBeGreaterThanOrEqual(16);
  });
});

describe("adapter selection", () => {
  it("enables fixtures only with the explicit dev flag", () => {
    expect(fixturesEnabled({ DEV: true, VITE_TAILOR_FIXTURES: "1" })).toBe(true);
    expect(fixturesEnabled({ DEV: false, VITE_TAILOR_FIXTURES: "1" })).toBe(false);
    expect(fixturesEnabled({ DEV: true })).toBe(false);
    expect(fixturesEnabled({ DEV: true, VITE_TAILOR_FIXTURES: "0" })).toBe(false);
  });

  it("fails closed in production instead of falling back to fixtures", async () => {
    const api = resolveTailorApi({ DEV: false, VITE_TAILOR_FIXTURES: "1" });
    await expect(api.me()).rejects.toBeInstanceOf(TailorApiError);
  });
});

describe("http adapter", () => {
  it("maps an API error envelope with its requestId", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "REVISION_CONFLICT",
              message: "Changed.",
              retryable: false,
              currentVersion: 6,
            },
            requestId: "req_test_1",
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        ),
    );
    const api = createHttpTailorApi(fetchFn as unknown as typeof fetch);
    await expect(api.me()).rejects.toMatchObject({
      code: "REVISION_CONFLICT",
      requestId: "req_test_1",
      currentVersion: 6,
    });
  });

  it("maps a network failure to FEATURE_UNAVAILABLE", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("offline");
    });
    const api = createHttpTailorApi(fetchFn as unknown as typeof fetch);
    await expect(api.me()).rejects.toMatchObject({ code: "FEATURE_UNAVAILABLE", retryable: true });
  });
});
