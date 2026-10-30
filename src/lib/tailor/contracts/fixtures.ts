import type { z } from "zod";
import { apiErrorSchema } from "./common";
import {
  assetSchema,
  briefSchema,
  checksResponseSchema,
  jobSchema,
  meResponseSchema,
  projectDetailSchema,
  templateDetailSchema,
  type Asset,
  type Brief,
  type ProjectDetail,
} from "./dto";
import { emptyProjectInput, projectInputSchema, type ProjectInput } from "./project-input";
import { createShareRequestSchema, reviewActionRequestSchema } from "./requests";
import { redactedBriefSchema, reviewSessionResponseSchema, type RedactedBrief } from "./review";

// Synthetic fixtures only. IDs, names and tokens below are not credentials
// and must never be seeded as production data or a published template.

const HASH = "a".repeat(64);
const NOW = "2026-10-30T10:00:00.000Z";

export const fixtureFabricAsset: Asset = {
  id: "ast_fixture_fabric",
  projectId: "prj_fixture_1",
  kind: "fabric_crop",
  mime: "image/jpeg",
  bytes: 2048,
  widthPx: 800,
  heightPx: 600,
  parentAssetId: "ast_fixture_fabric_source",
  createdAt: NOW,
};

export const fixtureConceptAsset: Asset = {
  id: "ast_fixture_concept",
  projectId: "prj_fixture_1",
  kind: "concept",
  mime: "image/png",
  bytes: 4096,
  widthPx: 1024,
  heightPx: 1024,
  parentAssetId: null,
  createdAt: NOW,
};

export const fixtureInputComplete: ProjectInput = {
  ...emptyProjectInput("Fixture dress", "Africa/Accra"),
  template: { id: "tpl_fixture_dress", version: 1 },
  fabric: {
    sourceAssetId: "ast_fixture_fabric_source",
    selection: {
      method: "manual_crop",
      sourceAssetId: "ast_fixture_fabric_source",
      cropAssetId: fixtureFabricAsset.id,
      maskAssetId: null,
      regionId: null,
      analysisJobId: null,
    },
    widthMm: 1140,
    lengthMm: 2700,
    enteredWidth: { value: "45", unit: "in" },
    enteredLength: { value: "3", unit: "yd" },
    directionality: "no",
    stretch: "no",
    shrinkage: "preshrunk",
    confirmedObservations: [{ key: "weave", value: "plain", origin: "user" }],
  },
  measurements: [
    {
      name: "bust",
      kind: "body",
      valueMm: 920,
      enteredValue: "92",
      enteredUnit: "cm",
      source: "customer_manual",
      sourceAssetId: null,
      recordedAt: NOW,
    },
  ],
  selectedConceptAssetId: fixtureConceptAsset.id,
};

export const fixtureInputEmpty: ProjectInput = emptyProjectInput(
  "Untitled fixture project",
  "Africa/Accra",
);

export const fixtureProjectDetail: ProjectDetail = {
  project: {
    id: "prj_fixture_1",
    title: "Fixture dress",
    status: "active",
    version: 2,
    currentRevisionId: "rev_fixture_1",
    latestBriefId: null,
    updatedAt: NOW,
  },
  draft: { version: 1, baseRevisionId: null, input: fixtureInputEmpty },
  currentRevision: null,
  latestJob: null,
  latestBriefSummary: null,
};

export const fixtureBrief: Brief = {
  id: "brf_fixture_1",
  projectId: "prj_fixture_1",
  revisionId: "rev_fixture_1",
  briefNumber: 1,
  state: "finalized",
  contentHash: HASH,
  createdAt: NOW,
  finalizedAt: NOW,
  content: {
    schemaVersion: 1,
    title: "Fixture dress",
    template: { id: "tpl_fixture_dress", version: 1, name: "Fixture dress (test only)" },
    inputSnapshot: fixtureInputComplete,
    conceptAssetId: fixtureConceptAsset.id,
    fabricAssetId: fixtureFabricAsset.id,
    measurements: [
      {
        ...fixtureInputComplete.measurements[0]!,
        id: "msr_fixture_bust",
        verification: { status: "unverified", actorName: null, method: null, verifiedAt: null },
      },
    ],
    constraint: {
      status: "unknown",
      rule: null,
      availableLengthMm: 2700,
      requiredLengthMm: null,
      assumptions: [],
      reasons: [
        {
          code: "NO_REVIEWED_RULE",
          message: "No tailor-reviewed rule is available for this fixture.",
        },
      ],
    },
    materials: [{ label: "Fixture fabric", quantity: null, source: "user" }],
    decisions: [],
    assumptions: [],
    questions: [],
    provenance: { modelIds: [], promptVersion: "fixture-v1", ruleVersion: null },
    disclaimer:
      "Fixture data for contract tests. Measurements are manual entries, not verified fit.",
  },
  assets: [fixtureFabricAsset, fixtureConceptAsset],
  blockers: [],
  review: {
    status: "awaiting_review",
    requiredMeasurementCount: 1,
    verifiedMeasurementCount: 0,
    actions: [],
  },
};

export const fixtureRedactedBriefNoMeasurements: RedactedBrief = {
  schemaVersion: 1,
  briefId: fixtureBrief.id,
  briefNumber: 1,
  contentHash: HASH,
  finalizedAt: NOW,
  title: "Fixture dress",
  template: { id: "tpl_fixture_dress", version: 1, name: "Fixture dress (test only)" },
  assets: [fixtureConceptAsset],
  measurements: null,
  constraintStatus: "unknown",
  materials: null,
  decisions: null,
  assumptions: null,
  questions: null,
  omittedSections: ["measurements", "materials", "decisions", "assumptions", "questions"],
  reviewStatus: "awaiting_review",
  disclaimer: "Fixture data for contract tests.",
};

export type Fixture =
  | { id: string; title: string; kind: "payload"; schema: z.ZodTypeAny; value: unknown }
  | { id: string; title: string; kind: "scenario"; expected: string };

export const FIXTURES: Fixture[] = [
  {
    id: "F01",
    title: "First use",
    kind: "payload",
    schema: projectDetailSchema,
    value: fixtureProjectDetail,
  },
  { id: "F02", title: "Normal path", kind: "payload", schema: briefSchema, value: fixtureBrief },
  {
    id: "F03",
    title: "Insufficient cloth",
    kind: "payload",
    schema: checksResponseSchema,
    value: {
      constraint: {
        status: "insufficient",
        rule: { templateId: "tpl_fixture_dress", version: 1, ruleVersion: "fixture-rule-v1" },
        availableLengthMm: 1000,
        requiredLengthMm: 2700,
        assumptions: [],
        reasons: [
          {
            code: "LENGTH_SHORT",
            message: "Available length is below the fixture rule requirement.",
          },
        ],
      },
      missingMeasurements: [],
      unverifiedMeasurements: ["bust"],
      blockers: [
        { code: "FABRIC_INSUFFICIENT", message: "Not enough fabric.", blocks: ["accept"] },
      ],
    },
  },
  {
    id: "F04",
    title: "Unknown cloth/rule",
    kind: "payload",
    schema: checksResponseSchema,
    value: {
      constraint: {
        status: "unknown",
        rule: null,
        availableLengthMm: null,
        requiredLengthMm: null,
        assumptions: [],
        reasons: [{ code: "NO_REVIEWED_RULE", message: "No reviewed rule." }],
      },
      missingMeasurements: [],
      unverifiedMeasurements: [],
      blockers: [
        { code: "FABRIC_UNKNOWN", message: "Fabric requirement is unknown.", blocks: ["accept"] },
      ],
    },
  },
  {
    id: "F05",
    title: "Missing measurements",
    kind: "payload",
    schema: projectInputSchema,
    value: fixtureInputEmpty,
  },
  {
    id: "F06",
    title: "SAM failure",
    kind: "payload",
    schema: jobSchema,
    value: {
      id: "job_fixture_sam_failed",
      projectId: "prj_fixture_1",
      revisionId: "rev_fixture_1",
      type: "analyze_fabric",
      state: "failed",
      stage: "segmenting",
      attemptCount: 1,
      createdAt: NOW,
      updatedAt: NOW,
      retryAfterMs: null,
      result: null,
      error: {
        code: "SEGMENTATION_FAILED",
        message: "Segmentation failed. Use manual crop or upload again.",
        retryable: true,
      },
    },
  },
  {
    id: "F07",
    title: "Provider failure",
    kind: "payload",
    schema: apiErrorSchema,
    value: {
      error: { code: "PROVIDER_UNAVAILABLE", message: "Provider unavailable.", retryable: true },
      requestId: "req_fixture_7",
    },
  },
  {
    id: "F08",
    title: "Ambiguous timeout",
    kind: "payload",
    schema: jobSchema,
    value: {
      id: "job_fixture_ambiguous",
      projectId: "prj_fixture_1",
      revisionId: "rev_fixture_1",
      type: "generate_concept",
      state: "needs_attention",
      stage: "generating",
      attemptCount: 1,
      createdAt: NOW,
      updatedAt: NOW,
      retryAfterMs: null,
      result: null,
      error: {
        code: "AMBIGUOUS_PROVIDER_RESULT",
        message: "The provider result is ambiguous.",
        retryable: true,
      },
    },
  },
  {
    id: "F09",
    title: "Concurrency",
    kind: "payload",
    schema: apiErrorSchema,
    value: {
      error: {
        code: "REVISION_CONFLICT",
        message: "This project changed. Reload the latest saved draft before continuing.",
        retryable: false,
        currentVersion: 6,
      },
      requestId: "req_fixture_9",
    },
  },
  {
    id: "F10",
    title: "Restricted share",
    kind: "payload",
    schema: redactedBriefSchema,
    value: fixtureRedactedBriefNoMeasurements,
  },
  {
    id: "F11",
    title: "Revoked/expired",
    kind: "scenario",
    expected:
      "Review session, asset and action requests return SHARE_REVOKED or SHARE_EXPIRED and the client clears sensitive state.",
  },
  {
    id: "F12",
    title: "Superseded brief",
    kind: "scenario",
    expected:
      "Finalizing a new brief supersedes the old brief, revokes its grants, and owner history stays readable.",
  },
  {
    id: "F13",
    title: "Two users",
    kind: "scenario",
    expected:
      "User B receives 404 NOT_FOUND for user A project, asset, job, revision, brief, upload and share resources.",
  },
  {
    id: "F14",
    title: "Delete mid-job",
    kind: "scenario",
    expected:
      "Project deletion revokes access immediately and a late provider result cannot publish; cleanup is tracked.",
  },
  {
    id: "F15",
    title: "Link identity",
    kind: "payload",
    schema: reviewSessionResponseSchema,
    value: {
      grant: {
        id: "grt_fixture_1",
        expiresAt: NOW,
        actions: ["approve_design"],
        includeMeasurements: false,
      },
      brief: fixtureRedactedBriefNoMeasurements,
      capabilities: { canApprove: true, canVerify: false, canAccept: false, blockingReasons: [] },
      reviewerIdentity: { method: "possession_link", verified: false },
    },
  },
  {
    id: "F16",
    title: "Consent withdrawal",
    kind: "scenario",
    expected:
      "Withdrawal blocks new processing and sharing for the scope, revokes dependent grants, and tracks derivative cleanup.",
  },
];

export const fixtureMe = {
  user: { id: "usr_fixture_1", displayName: "Fixture User", email: "fixture@example.invalid" },
  preferences: { measurementUnit: "cm", timezone: "Africa/Accra", version: 1 },
  credits: { available: 0, reserved: 0 },
  capabilities: { personUpload: false, manualCrop: true },
  policy: { version: "fixture-policy-v1", personRetentionDays: 30 },
  jobQuotes: { analyze_fabric: 0, generate_concept: 0, assemble_brief: 0 },
};

export const fixtureTemplateDetail = {
  id: "tpl_fixture_dress",
  version: 1,
  name: "Fixture dress (test only)",
  garmentKind: "dress",
  description: "Synthetic contract fixture. Not a published production template.",
  measurementFields: [
    {
      name: "bust",
      kind: "body",
      label: "Bust",
      guidance: "Measure around the fullest part.",
      required: true,
      unit: "cm",
    },
  ],
  designOptions: [
    { id: "sleeve", label: "Sleeve", choices: [{ id: "sleeveless", label: "Sleeveless" }] },
  ],
  hasReviewedRule: false,
};

export const contractFixtureSchemas = {
  meResponseSchema,
  templateDetailSchema,
  assetSchema,
  createShareRequestSchema,
  reviewActionRequestSchema,
};
