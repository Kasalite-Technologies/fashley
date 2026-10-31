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

  it("polls a queued-first concept job to completion", async () => {
    const api = createFixtureTailorApi();
    const detail = await api.getProject("prj_fixture_1");
    const started = await api.startJob(
      "prj_fixture_1",
      { type: "generate_concept", revisionId: "rev_fixture_1" },
      "key-concept",
    );
    expect(started.job.state).toBe("queued");
    expect((await api.getJob(started.job.id)).state).toBe("running");
    const done = await api.getJob(started.job.id);
    expect(done.state).toBe("completed");
    expect(done.result?.type).toBe("generate_concept");
    // Reload recovery source: the project now reports this job as latest.
    expect((await api.getProject(detail.project.id)).latestJob?.id).toBe(started.job.id);
  });

  it("polls a queued-first brief job to completion and an analyze job to regions", async () => {
    const api = createFixtureTailorApi();
    const brief = await api.createBrief("prj_fixture_1", { revisionId: "rev_fixture_1" }, "k-brief");
    expect(brief.job.state).toBe("queued");
    await api.getJob(brief.job.id);
    const briefDone = await api.getJob(brief.job.id);
    expect(briefDone.result).toEqual({ type: "assemble_brief", briefId: "brf_fixture_1" });

    const analyze = await api.startJob(
      "prj_fixture_1",
      { type: "analyze_fabric", revisionId: "rev_fixture_1" },
      "k-analyze",
    );
    await api.getJob(analyze.job.id);
    const analyzeDone = await api.getJob(analyze.job.id);
    expect(analyzeDone.result?.type).toBe("analyze_fabric");
    if (analyzeDone.result?.type === "analyze_fabric") {
      expect(analyzeDone.result.segmentation.regions).toHaveLength(1);
      expect(analyzeDone.result.observations).toHaveLength(1);
    }
  });

  it("persists a concept selection through patchDraft (selection-persist path)", async () => {
    const api = createFixtureTailorApi();
    const detail = await api.getProject("prj_fixture_1");
    await api.patchDraft("prj_fixture_1", {
      expectedDraftVersion: detail.draft.version,
      input: { ...detail.draft.input, selectedConceptAssetId: "ast_fixture_concept" },
    });
    const after = await api.getProject("prj_fixture_1");
    expect(after.draft.input.selectedConceptAssetId).toBe("ast_fixture_concept");
  });

  it("rejects retry for a job that is not failed/cancelled", async () => {
    const api = createFixtureTailorApi();
    const started = await api.startJob(
      "prj_fixture_1",
      { type: "generate_concept", revisionId: "rev_fixture_1" },
      "key-retry",
    );
    await expect(api.retryJob(started.job.id, {}, "k-r")).rejects.toMatchObject({
      code: "JOB_NOT_RETRYABLE",
    });
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

  it("unwraps a {data:{job}} envelope and forwards the retry acknowledgement", async () => {
    const job = {
      id: "job_http_1",
      projectId: "prj_http_1",
      revisionId: "rev_http_1",
      type: "generate_concept",
      state: "failed",
      stage: null,
      attemptCount: 1,
      createdAt: "2026-10-30T10:00:00.000Z",
      updatedAt: "2026-10-30T10:00:00.000Z",
      retryAfterMs: null,
      result: null,
      error: { code: "AMBIGUOUS_PROVIDER_RESULT", message: "Unclear.", retryable: true },
    };
    const calls: Array<{ url: string; body?: string }> = [];
    const fetchFn = vi.fn(async (url: string, init?: { body?: string }) => {
      calls.push({ url, ...(init?.body ? { body: init.body } : {}) });
      // retryJob unwraps the envelope to a bare Job (jobSchema), not {job}.
      return new Response(
        JSON.stringify({ data: { ...job, state: "queued", error: null }, requestId: "req_http_1" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const api = createHttpTailorApi(fetchFn as unknown as typeof fetch);
    const retried = await api.retryJob(
      "job_http_1",
      { acknowledgePossibleProviderCost: true },
      "retry-key-1",
    );
    expect(retried.state).toBe("queued");
    expect(calls[0]?.url).toContain("/api/tailor/jobs/job_http_1/retry");
    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({
      acknowledgePossibleProviderCost: true,
    });

    const envelopeFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: job, requestId: "req_http_1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const api2 = createHttpTailorApi(envelopeFetch as unknown as typeof fetch);
    await expect(api2.getJob("job_http_1")).resolves.toMatchObject({ id: "job_http_1", state: "failed" });

    const startFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ data: { job, credits: { reserved: 0 } }, requestId: "req_http_1" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const api3 = createHttpTailorApi(startFetch as unknown as typeof fetch);
    const started = await api3.startJob(
      "prj_http_1",
      { type: "generate_concept", revisionId: "rev_http_1" },
      "start-key-1",
    );
    expect(started.job.id).toBe("job_http_1");
    expect(started.credits.reserved).toBe(0);
  });

  it("maps a network failure to FEATURE_UNAVAILABLE", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("offline");
    });
    const api = createHttpTailorApi(fetchFn as unknown as typeof fetch);
    await expect(api.me()).rejects.toMatchObject({ code: "FEATURE_UNAVAILABLE", retryable: true });
  });
});
