import { describe, expect, it } from "vitest";
import {
  apiErrorSchema,
  idempotencyKeySchema,
  listQuerySchema,
  successEnvelopeSchema,
} from "./common";
import {
  assetSchema,
  briefSchema,
  jobResultSchema,
  meResponseSchema,
  templateDetailSchema,
} from "./dto";
import {
  FIXTURES,
  fixtureBrief,
  fixtureInputComplete,
  fixtureInputEmpty,
  fixtureMe,
  fixtureTemplateDetail,
} from "./fixtures";
import { projectInputSchema } from "./project-input";
import { createShareRequestSchema, reviewActionRequestSchema } from "./requests";
import { redactedBriefSchema } from "./review";

describe("G0 contract fixtures F01-F16", () => {
  it("covers exactly F01 through F16", () => {
    expect(FIXTURES.map((f) => f.id)).toEqual(
      Array.from({ length: 16 }, (_, i) => `F${String(i + 1).padStart(2, "0")}`),
    );
  });

  it("parses every payload fixture against its frozen schema", () => {
    for (const fixture of FIXTURES) {
      if (fixture.kind === "payload") {
        expect(fixture.schema.safeParse(fixture.value).success, fixture.id).toBe(true);
      } else {
        expect(fixture.expected.length, fixture.id).toBeGreaterThan(0);
      }
    }
  });

  it("parses supporting me/template/asset fixtures", () => {
    expect(meResponseSchema.safeParse(fixtureMe).success).toBe(true);
    expect(templateDetailSchema.safeParse(fixtureTemplateDetail).success).toBe(true);
    expect(assetSchema.safeParse(fixtureBrief.assets[0]).success).toBe(true);
  });
});

describe("contract rejection cases", () => {
  it("rejects unknown error codes and leaks in the redacted reviewer DTO", () => {
    expect(
      apiErrorSchema.safeParse({
        error: { code: "RAW_PROVIDER_BODY", message: "x", retryable: false },
        requestId: "r1",
      }).success,
    ).toBe(false);
    expect(
      redactedBriefSchema.safeParse({ ...fixtureBrief, ownerUserId: "usr_other" }).success,
    ).toBe(false);
    expect(
      successEnvelopeSchema(apiErrorSchema).safeParse({
        data: { error: { code: "NOT_FOUND", message: "x", retryable: false }, requestId: "r1" },
        requestId: "r1",
      }).success,
    ).toBe(true);
  });

  it("keeps missing measurements null, never zero", () => {
    expect(projectInputSchema.safeParse(fixtureInputEmpty).success).toBe(true);
    const zero = structuredClone(fixtureInputComplete);
    zero.measurements[0]!.valueMm = 0;
    expect(projectInputSchema.safeParse(zero).success).toBe(false);
  });

  it("rejects oversized inputs and invalid pagination/idempotency keys", () => {
    const tooManyQuestions = structuredClone(fixtureInputEmpty);
    tooManyQuestions.customerQuestions = Array.from({ length: 11 }, (_, i) => `q${i}`);
    expect(projectInputSchema.safeParse(tooManyQuestions).success).toBe(false);
    expect(listQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(listQuerySchema.parse({}).limit).toBe(20);
    expect(idempotencyKeySchema.safeParse("short").success).toBe(false);
    expect(idempotencyKeySchema.safeParse("freeze-8b9c1e5c-example").success).toBe(true);
  });

  it("enforces job result discriminators", () => {
    expect(jobResultSchema.safeParse({ type: "assemble_brief", briefId: "brf_1" }).success).toBe(
      true,
    );
    expect(jobResultSchema.safeParse({ type: "generate_concept", briefId: "brf_1" }).success).toBe(
      false,
    );
  });

  it("requires measurements to be shared before verify/accept share actions", () => {
    const base = {
      expectedContentHash: "a".repeat(64),
      expiresInHours: 6 as const,
      includeMeasurements: false,
      permittedAssetIds: ["ast_1"],
      consentId: "con_1",
    };
    expect(
      createShareRequestSchema.safeParse({ ...base, actions: ["approve_design"] }).success,
    ).toBe(true);
    expect(createShareRequestSchema.safeParse({ ...base, actions: ["accept_brief"] }).success).toBe(
      false,
    );
  });

  it("requires a note for change requests and values for verifications", () => {
    const base = {
      briefId: "brf_1",
      expectedContentHash: "a".repeat(64),
      reviewerName: "Fixture Tailor",
    };
    expect(
      reviewActionRequestSchema.safeParse({ ...base, action: "request_changes" }).success,
    ).toBe(false);
    expect(
      reviewActionRequestSchema.safeParse({
        ...base,
        action: "request_changes",
        note: "Adjust sleeve.",
      }).success,
    ).toBe(true);
    expect(
      reviewActionRequestSchema.safeParse({ ...base, action: "verify_measurements" }).success,
    ).toBe(false);
    expect(
      reviewActionRequestSchema.safeParse({
        ...base,
        action: "verify_measurements",
        verifications: [{ measurementId: "msr_1", valueMm: 920, method: "in_person_tape" }],
      }).success,
    ).toBe(true);
  });

  it("owner brief does not parse as a redacted brief", () => {
    expect(briefSchema.safeParse(fixtureBrief).success).toBe(true);
    expect(redactedBriefSchema.safeParse(fixtureBrief).success).toBe(false);
  });
});
