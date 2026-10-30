import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDb } from "./db";
import { ensureLocalUser, createConsent, withdrawConsent } from "./identity";
import {
  createProject,
  getProjectDetail,
  saveDraft,
  freezeRevision,
  insertAsset,
} from "./projects";
import { assembleBrief, finalizeBrief, getOwnedBrief } from "./briefs";
import { createShare, exchangeReview, getReviewSessionView, submitReviewAction } from "./shares";
import { pilotGrant, reserveCredits, settleCredits, getAccount } from "./credits";
import { evaluateConstraints } from "./constraints";
import { listPublishedTemplates } from "./templates";
import { createTailorHandlers } from "./http";
import { emptyProjectInput, type ProjectInput } from "../contracts";

const MIGRATIONS = readdirSync(join(process.cwd(), "migrations/tailor"))
  .sort()
  .map((f) => readFileSync(join(process.cwd(), "migrations/tailor", f), "utf8"));
async function makeDb() {
  const db = new InMemoryDb();
  for (const sql of MIGRATIONS) await db.exec(sql);
  return db;
}
const actor = (s: string) => ({ subject: s, displayName: s, email: `${s}@example.invalid` });
const KEY = (n: string) => `test-key-${n}-1234567890`;

async function seedTemplate(db: InMemoryDb, status = "published") {
  await db
    .prepare(
      "INSERT INTO garment_templates (id, version, status, name, garment_kind, description, illustration_key, measurement_schema_json, design_options_json, rule_json, reviewer_name, reviewed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      "tpl_test",
      1,
      status,
      "Test dress (TEST ONLY)",
      "dress",
      "test fixture",
      null,
      JSON.stringify([
        { name: "bust", kind: "body", label: "Bust", guidance: "tape", required: true, unit: "cm" },
      ]),
      JSON.stringify([]),
      status === "published"
        ? JSON.stringify({
            requiredLengthMm: 2000,
            ruleVersion: "test-rule-v1",
            requiredMeasurements: ["bust"],
          })
        : null,
      status === "published" ? "TEST ONLY fixture reviewer" : null,
      status === "published" ? Date.now() : null,
      Date.now(),
    )
    .run();
}
function completeInput(): ProjectInput {
  const input = emptyProjectInput("Test dress", "Africa/Accra");
  input.template = { id: "tpl_test", version: 1 };
  input.fabric = {
    ...input.fabric,
    sourceAssetId: "ast_src",
    selection: {
      method: "manual_crop",
      sourceAssetId: "ast_src",
      cropAssetId: "ast_crop",
      maskAssetId: null,
      regionId: null,
      analysisJobId: null,
    },
    widthMm: 1140,
    lengthMm: 2700,
  };
  input.measurements = [
    {
      name: "bust",
      kind: "body",
      valueMm: 920,
      enteredValue: "92",
      enteredUnit: "cm",
      source: "customer_manual",
      sourceAssetId: null,
      recordedAt: null,
    },
  ];
  input.selectedConceptAssetId = "ast_concept";
  return input;
}
async function finalizedBrief(db: InMemoryDb, subject = "user_a") {
  await seedTemplate(db);
  const { userId } = await ensureLocalUser(db, actor(subject));
  const { detail } = await createProject(db, userId, KEY("create"), {
    title: "Test dress",
    template: { id: "tpl_test", version: 1 },
    occasion: null,
    deadline: null,
    fit: "regular",
    timezone: "Africa/Accra",
  });
  const projectId = detail.project.id;
  await insertAsset(db, {
    id: "ast_crop",
    projectId,
    ownerUserId: userId,
    kind: "fabric_crop",
    mime: "image/jpeg",
    bytes: 10,
    widthPx: 10,
    heightPx: 10,
  });
  await insertAsset(db, {
    id: "ast_concept",
    projectId,
    ownerUserId: userId,
    kind: "concept",
    mime: "image/png",
    bytes: 10,
    widthPx: 10,
    heightPx: 10,
  });
  const saved = await saveDraft(db, userId, projectId, {
    expectedDraftVersion: 1,
    input: completeInput(),
  });
  const frozen = await freezeRevision(db, userId, projectId, KEY("freeze"), {
    expectedDraftVersion: saved.draftVersion,
    expectedProjectVersion: saved.projectVersion,
  });
  const brief = await assembleBrief(db, userId, projectId, frozen.revision.id);
  const detail2 = await getProjectDetail(db, userId, projectId);
  const fin = await finalizeBrief(db, userId, brief.id, KEY("final"), {
    expectedProjectVersion: detail2.project.version,
    expectedContentHash: brief.contentHash,
    acknowledgedBlockerCodes: [],
  });
  const { consent } = await createConsent(db, userId, KEY("consent"), {
    purpose: "tailor_share",
    policyVersion: "v1",
    projectId,
  });
  return {
    userId,
    projectId,
    revisionId: frozen.revision.id,
    brief: fin.brief,
    consentId: consent.id,
  };
}

describe("migrations", () => {
  it("define all core tables, uniqueness and settlement guards", async () => {
    const all = MIGRATIONS.join("\n");
    for (const t of [
      "app_users",
      "auth_identities",
      "tailor_projects",
      "project_revisions",
      "revision_measurements",
      "consents",
      "assets",
      "ai_jobs",
      "brief_revisions",
      "share_grants",
      "review_actions",
      "measurement_attestations",
      "credit_accounts",
      "credit_reservations",
      "credit_ledger",
      "mutation_receipts",
      "audit_events",
      "cleanup_tasks",
    ])
      expect(all, t).toContain(`CREATE TABLE ${t}`);
    expect(all).toContain("UNIQUE (provider, subject)");
    expect(all).toContain("UNIQUE (actor_scope, operation, idempotency_key)");
    expect(all).toContain("token_hash TEXT NOT NULL UNIQUE");
    expect(all).toContain("operation_key TEXT NOT NULL UNIQUE");
    expect(all).toContain("trg_credit_reservation_terminal_once");
    const db = await makeDb();
    expect(db.tables.has("share_grants")).toBe(true);
    await expect(
      db
        .prepare(
          "INSERT INTO share_grants (id, brief_id, owner_user_id, token_hash, token_prefix, allowed_actions_json, include_measurements, permitted_asset_ids_json, consent_id, pin_hash, failed_pin_attempts, pin_blocked_until, expires_at, revoked_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind("g1", "b", "u", "hash1", "p", "[]", 0, "[]", "c", null, 0, null, 1, null, 1)
        .run(),
    ).resolves.toBeTruthy();
    await expect(
      db
        .prepare(
          "INSERT INTO share_grants (id, brief_id, owner_user_id, token_hash, token_prefix, allowed_actions_json, include_measurements, permitted_asset_ids_json, consent_id, pin_hash, failed_pin_attempts, pin_blocked_until, expires_at, revoked_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind("g2", "b", "u", "hash1", "p", "[]", 0, "[]", "c", null, 0, null, 1, null, 1)
        .run(),
    ).rejects.toThrow(/UNIQUE/);
  });
  it("fixture template is not published/listed", async () => {
    const db = await makeDb();
    await seedTemplate(db, "draft");
    expect(await listPublishedTemplates(db)).toEqual([]);
  });
});

describe("identity, isolation, revisions, idempotency", () => {
  it("maps concurrent first requests to one user and isolates two users", async () => {
    const db = await makeDb();
    const [a1, a2] = await Promise.all([
      ensureLocalUser(db, actor("clerk_a")),
      ensureLocalUser(db, actor("clerk_a")),
    ]);
    expect(a1.userId).toBe(a2.userId);
    const { userId: bId } = await ensureLocalUser(db, actor("clerk_b"));
    const { detail } = await createProject(db, a1.userId, KEY("p1"), {
      title: "A",
      template: { id: "tpl_test", version: 1 },
      occasion: null,
      deadline: null,
      fit: "regular",
      timezone: "Africa/Accra",
    });
    await expect(getProjectDetail(db, bId, detail.project.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
  it("rejects stale draft saves and replays create idempotently", async () => {
    const db = await makeDb();
    const { userId } = await ensureLocalUser(db, actor("clerk_a"));
    const req = {
      title: "A",
      template: { id: "tpl_test", version: 1 },
      occasion: null,
      deadline: null,
      fit: "regular" as const,
      timezone: "Africa/Accra",
    };
    const first = await createProject(db, userId, KEY("same"), req);
    const replay = await createProject(db, userId, KEY("same"), req);
    expect(replay.replayed).toBe(true);
    expect(replay.detail.project.id).toBe(first.detail.project.id);
    await expect(
      createProject(db, userId, KEY("same"), { ...req, title: "Different" }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    const pid = first.detail.project.id;
    await saveDraft(db, userId, pid, {
      expectedDraftVersion: 1,
      input: emptyProjectInput("A2", "Africa/Accra"),
    });
    await expect(
      saveDraft(db, userId, pid, {
        expectedDraftVersion: 1,
        input: emptyProjectInput("A3", "Africa/Accra"),
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });
});

describe("constraints (deterministic, unknown fallback)", () => {
  const rule = {
    requiredLengthMm: 2000,
    ruleVersion: "test-rule-v1",
    requiredMeasurements: ["bust"],
  };
  it("unknown without rule, sufficient/insufficient with explicit test-only rule", () => {
    const input = completeInput();
    expect(evaluateConstraints(input, { rule: null }).constraint.status).toBe("unknown");
    expect(
      evaluateConstraints(input, { rule, templateId: "tpl_test", templateVersion: 1 }).constraint
        .status,
    ).toBe("sufficient");
    expect(
      evaluateConstraints(
        { ...input, fabric: { ...input.fabric, lengthMm: 500 } },
        { rule, templateId: "tpl_test", templateVersion: 1 },
      ).constraint.status,
    ).toBe("insufficient");
    expect(
      evaluateConstraints(
        { ...input, fabric: { ...input.fabric, lengthMm: null } },
        { rule, templateId: "tpl_test", templateVersion: 1 },
      ).constraint.status,
    ).toBe("unknown");
  });
});

describe("credits: exactly-once settlement", () => {
  it("reserve/settle debit once; insufficient reserve persists nothing", async () => {
    const db = await makeDb();
    const { userId } = await ensureLocalUser(db, actor("clerk_a"));
    await pilotGrant(db, userId, 100, "grant-1");
    await pilotGrant(db, userId, 100, "grant-1");
    expect((await getAccount(db, userId)).balance).toBe(100);
    await reserveCredits(db, { userId, jobId: "job_1", amount: 30 });
    expect(await settleCredits(db, { userId, jobId: "job_1", outcome: "debit" })).toMatchObject({
      state: "debited",
    });
    expect(await settleCredits(db, { userId, jobId: "job_1", outcome: "debit" })).toMatchObject({
      state: "debited",
      replayed: true,
    });
    expect(await settleCredits(db, { userId, jobId: "job_1", outcome: "release" })).toMatchObject({
      state: "debited",
      replayed: true,
    });
    expect(await getAccount(db, userId)).toMatchObject({ balance: 70, reserved: 0 });
    await expect(reserveCredits(db, { userId, jobId: "job_2", amount: 999 })).rejects.toMatchObject(
      { code: "BUDGET_EXCEEDED" },
    );
    expect(
      await db.prepare("SELECT * FROM credit_reservations WHERE job_id = ?").bind("job_2").first(),
    ).toBeNull();
  });
});

describe("brief, share and review integrity", () => {
  it("hashes token/PIN, redacts excluded measurements and owner ids, gates verify/accept", async () => {
    const db = await makeDb();
    const ctx = await finalizedBrief(db);
    const share = await createShare(db, ctx.userId, ctx.brief.id, KEY("share"), {
      expectedContentHash: ctx.brief.contentHash,
      expiresInHours: 24,
      includeMeasurements: false,
      permittedAssetIds: ["ast_concept"],
      actions: ["approve_design"],
      pin: "1234",
      consentId: ctx.consentId,
    });
    const token = share.reviewUrl!.replace("/review/", "");
    const row = await db
      .prepare("SELECT * FROM share_grants WHERE id = ?")
      .bind(share.grant.id)
      .first<{ token_hash: string; pin_hash: string }>();
    expect(row!.token_hash).not.toContain(token);
    expect(row!.pin_hash).not.toContain("1234");
    const replay = await createShare(db, ctx.userId, ctx.brief.id, KEY("share"), {
      expectedContentHash: ctx.brief.contentHash,
      expiresInHours: 24,
      includeMeasurements: false,
      permittedAssetIds: ["ast_concept"],
      actions: ["approve_design"],
      pin: "1234",
      consentId: ctx.consentId,
    });
    expect(replay).toMatchObject({ reviewUrl: null, linkAlreadyIssued: true });
    const ex = await exchangeReview(db, { token, pin: "1234" });
    const view = await getReviewSessionView(db, ex.sessionToken);
    expect(view.brief.measurements).toBeNull();
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("920");
    expect(serialized).not.toContain(ctx.userId);
    expect(serialized).not.toContain("owner_user");
    await expect(
      submitReviewAction(db, ex.sessionToken, KEY("act1"), {
        briefId: ctx.brief.id,
        expectedContentHash: ctx.brief.contentHash,
        action: "verify_measurements",
        reviewerName: "Tailor",
        verifications: [{ measurementId: "x", valueMm: 920, method: "in_person_tape" }],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // consent withdrawal blocks new share creation
    await withdrawConsent(db, ctx.userId, ctx.consentId, KEY("withdraw"));
    await expect(
      createShare(db, ctx.userId, ctx.brief.id, KEY("share2"), {
        expectedContentHash: ctx.brief.contentHash,
        expiresInHours: 24,
        includeMeasurements: false,
        permittedAssetIds: ["ast_concept"],
        actions: ["approve_design"],
        consentId: ctx.consentId,
      }),
    ).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
    // and revokes the existing grant
    await expect(exchangeReview(db, { token, pin: "1234" })).rejects.toMatchObject({
      code: "SHARE_REVOKED",
    });
  });

  it("verifies exact values, approves, accepts; supersession kills old session actions", async () => {
    const db = await makeDb();
    const ctx = await finalizedBrief(db);
    const { userId: other } = await ensureLocalUser(db, actor("clerk_b"));
    await expect(getOwnedBrief(db, other, ctx.brief.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const share = await createShare(db, ctx.userId, ctx.brief.id, KEY("share"), {
      expectedContentHash: ctx.brief.contentHash,
      expiresInHours: 24,
      includeMeasurements: true,
      permittedAssetIds: ["ast_concept", "ast_crop"],
      actions: ["approve_design", "verify_measurements", "accept_brief"],
      consentId: ctx.consentId,
    });
    const token = share.reviewUrl!.replace("/review/", "");
    const ex = await exchangeReview(db, { token });
    const msr = await db
      .prepare("SELECT * FROM revision_measurements WHERE revision_id = ?")
      .bind(ctx.revisionId)
      .first<{ id: string }>();
    await expect(
      submitReviewAction(db, ex.sessionToken, KEY("bad"), {
        briefId: ctx.brief.id,
        expectedContentHash: ctx.brief.contentHash,
        action: "verify_measurements",
        reviewerName: "Tailor",
        verifications: [{ measurementId: msr!.id, valueMm: 999, method: "in_person_tape" }],
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await submitReviewAction(db, ex.sessionToken, KEY("verify"), {
      briefId: ctx.brief.id,
      expectedContentHash: ctx.brief.contentHash,
      action: "verify_measurements",
      reviewerName: "Tailor",
      verifications: [{ measurementId: msr!.id, valueMm: 920, method: "in_person_tape" }],
    });
    await submitReviewAction(db, ex.sessionToken, KEY("approve"), {
      briefId: ctx.brief.id,
      expectedContentHash: ctx.brief.contentHash,
      action: "approve_design",
      reviewerName: "Tailor",
    });
    const accepted = await submitReviewAction(db, ex.sessionToken, KEY("accept"), {
      briefId: ctx.brief.id,
      expectedContentHash: ctx.brief.contentHash,
      action: "accept_brief",
      reviewerName: "Tailor",
    });
    expect(accepted.review.status).toBe("accepted");
    // supersede with a new finalized brief
    const brief2 = await assembleBrief(db, ctx.userId, ctx.projectId, ctx.revisionId);
    const detail = await getProjectDetail(db, ctx.userId, ctx.projectId);
    await finalizeBrief(db, ctx.userId, brief2.id, KEY("final2"), {
      expectedProjectVersion: detail.project.version,
      expectedContentHash: brief2.contentHash,
      acknowledgedBlockerCodes: [],
    });
    await expect(
      submitReviewAction(db, ex.sessionToken, KEY("late"), {
        briefId: ctx.brief.id,
        expectedContentHash: ctx.brief.contentHash,
        action: "approve_design",
        reviewerName: "Tailor",
      }),
    ).rejects.toMatchObject({ code: "SHARE_REVOKED" });
  });
});

describe("http fail-closed", () => {
  it("returns FEATURE_UNAVAILABLE without bindings and UNAUTHENTICATED with a null verifier", async () => {
    const noDeps = createTailorHandlers({});
    const r1 = await noDeps.me(new Request("http://x/api/tailor/me"));
    expect(r1.status).toBe(503);
    expect((await r1.json()).error.code).toBe("FEATURE_UNAVAILABLE");
    const db = await makeDb();
    const noVerifier = createTailorHandlers({ db });
    expect(
      (await (await noVerifier.me(new Request("http://x/api/tailor/me"))).json()).error.code,
    ).toBe("FEATURE_UNAVAILABLE");
    const nullVerifier = createTailorHandlers({ db, verifier: async () => null });
    const r3 = await nullVerifier.me(new Request("http://x/api/tailor/me"));
    expect(r3.status).toBe(401);
    expect((await r3.json()).error.code).toBe("UNAUTHENTICATED");
  });
});
