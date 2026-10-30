import type { Db } from "./db";
import { conflict, err, newId, notFound } from "./errors";
import { hashSecret, nowMs, randomToken, sha256Hex, toIso, verifySecret } from "./util";
import { checkReceipt, storeReceipt } from "./receipts";
import { getActiveConsent } from "./identity";
import { deriveReview, getBriefRow, measurementViews, toBrief } from "./briefs";
import { getOwnedProject } from "./projects";
import type { RedactedBrief, ReviewAction } from "../contracts";

export interface GrantRow {
  id: string;
  brief_id: string;
  owner_user_id: string;
  token_hash: string;
  token_prefix: string;
  allowed_actions_json: string;
  include_measurements: number;
  permitted_asset_ids_json: string;
  consent_id: string;
  pin_hash: string | null;
  failed_pin_attempts: number;
  pin_blocked_until: number | null;
  expires_at: number;
  revoked_at: number | null;
  created_at: number;
}
const toGrantSummary = (g: GrantRow) => ({
  id: g.id,
  briefId: g.brief_id,
  expiresAt: toIso(g.expires_at),
  revokedAt: g.revoked_at ? toIso(g.revoked_at) : null,
  includeMeasurements: Boolean(g.include_measurements),
  permittedAssetIds: JSON.parse(g.permitted_asset_ids_json) as string[],
  actions: JSON.parse(g.allowed_actions_json),
  createdAt: toIso(g.created_at),
});

export async function createShare(
  db: Db,
  userId: string,
  briefId: string,
  key: string,
  req: {
    expectedContentHash: string;
    expiresInHours: 1 | 6 | 24;
    includeMeasurements: boolean;
    permittedAssetIds: string[];
    actions: string[];
    pin?: string | undefined;
    consentId: string;
  },
) {
  const payload = { briefId, ...req, pin: req.pin ? "present" : "absent" };
  const replay = await checkReceipt(db, userId, "create_share", key, payload);
  if (replay) {
    const prior = replay.response as { grant: ReturnType<typeof toGrantSummary> };
    // Never re-issue the raw token: receipts store no secret.
    return {
      grant: prior.grant,
      reviewUrl: null as string | null,
      linkAlreadyIssued: true,
      replayed: true,
    };
  }
  const brief = await getBriefRow(db, briefId);
  await getOwnedProject(db, userId, brief.project_id);
  if (brief.state !== "finalized")
    throw err("BRIEF_BLOCKED", "Only a finalized brief can be shared.");
  if (brief.content_hash !== req.expectedContentHash) throw conflict();
  if (
    !req.includeMeasurements &&
    req.actions.some((a) => a === "verify_measurements" || a === "accept_brief")
  )
    throw err("INVALID_INPUT", "verify_measurements and accept_brief require includeMeasurements.");
  // Consent withdrawal blocks share creation (getActiveConsent throws for withdrawn).
  const consent = await getActiveConsent(db, userId, req.consentId, "tailor_share");
  if (consent.project_id && consent.project_id !== brief.project_id)
    throw err("CONSENT_REQUIRED", "Consent is scoped to a different project.");
  const { results: bas } = await db
    .prepare("SELECT * FROM brief_assets WHERE brief_id = ?")
    .bind(briefId)
    .all<{ asset_id: string }>();
  const allowed = new Set(bas.map((b) => b.asset_id));
  if (req.permittedAssetIds.some((a) => !allowed.has(a)))
    throw err("INVALID_INPUT", "Permitted assets must be part of this brief.");
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const grantId = newId("grt");
  const now = nowMs();
  const expiresAt = now + req.expiresInHours * 3_600_000;
  await db
    .prepare(
      "INSERT INTO share_grants (id, brief_id, owner_user_id, token_hash, token_prefix, allowed_actions_json, include_measurements, permitted_asset_ids_json, consent_id, pin_hash, failed_pin_attempts, pin_blocked_until, expires_at, revoked_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      grantId,
      briefId,
      userId,
      tokenHash,
      token.slice(0, 8),
      JSON.stringify(req.actions),
      req.includeMeasurements ? 1 : 0,
      JSON.stringify(req.permittedAssetIds),
      req.consentId,
      req.pin ? await hashSecret(req.pin) : null,
      0,
      null,
      expiresAt,
      null,
      now,
    )
    .run();
  const row = await db
    .prepare("SELECT * FROM share_grants WHERE id = ?")
    .bind(grantId)
    .first<GrantRow>();
  const grant = toGrantSummary(row!);
  await storeReceipt(db, userId, "create_share", key, payload, { grant });
  return { grant, reviewUrl: `/review/${token}`, linkAlreadyIssued: false, replayed: false };
}
export async function listShares(db: Db, userId: string, briefId: string) {
  const brief = await getBriefRow(db, briefId);
  await getOwnedProject(db, userId, brief.project_id);
  const { results } = await db
    .prepare("SELECT * FROM share_grants WHERE brief_id = ? ORDER BY created_at DESC")
    .bind(briefId)
    .all<GrantRow>();
  return results.map(toGrantSummary);
}
export async function revokeShare(db: Db, userId: string, grantId: string, key: string) {
  const payload = { grantId };
  const replay = await checkReceipt(db, userId, "revoke_share", key, payload);
  if (replay) return replay.response as { id: string; revokedAt: string };
  const g = await db
    .prepare("SELECT * FROM share_grants WHERE id = ? AND owner_user_id = ?")
    .bind(grantId, userId)
    .first<GrantRow>();
  if (!g) throw notFound();
  const now = g.revoked_at ?? nowMs();
  if (!g.revoked_at) {
    await db.batch([
      db.prepare("UPDATE share_grants SET revoked_at = ? WHERE id = ?").bind(now, grantId),
      db
        .prepare(
          "UPDATE review_sessions SET revoked_at = ? WHERE grant_id = ? AND revoked_at IS NULL",
        )
        .bind(now, grantId),
    ]);
  }
  const result = { id: grantId, revokedAt: toIso(now) };
  await storeReceipt(db, userId, "revoke_share", key, payload, result);
  return result;
}

async function assertGrantUsable(db: Db, g: GrantRow) {
  if (g.revoked_at) throw err("SHARE_REVOKED", "This review link has been revoked.");
  if (g.expires_at <= nowMs()) throw err("SHARE_EXPIRED", "This review link has expired.");
  const brief = await getBriefRow(db, g.brief_id);
  if (brief.state !== "finalized")
    throw err("SHARE_REVOKED", "This brief is no longer the current shared version.");
  const project = await db
    .prepare("SELECT * FROM tailor_projects WHERE id = ?")
    .bind(brief.project_id)
    .first<{ status: string }>();
  if (!project || project.status === "deleted" || project.status === "deleting")
    throw err("SHARE_REVOKED", "This brief is no longer available.");
  return brief;
}

/** Token exchange with PIN throttling. Raw token/session are never stored. */
export async function exchangeReview(db: Db, req: { token: string; pin?: string | undefined }) {
  const tokenHash = await sha256Hex(req.token);
  const bucket = await sha256Hex(`review:${tokenHash}`);
  const now = nowMs();
  const rl = await db
    .prepare("SELECT * FROM review_rate_limits WHERE bucket_key_hash = ?")
    .bind(bucket)
    .first<{ window_start: number; attempt_count: number; blocked_until: number | null }>();
  if (rl?.blocked_until && rl.blocked_until > now)
    throw err("RATE_LIMITED", "Too many attempts. Try again later.");
  const bump = async () => {
    if (!rl || now - rl.window_start > 600_000) {
      if (rl)
        await db
          .prepare("DELETE FROM review_rate_limits WHERE bucket_key_hash = ?")
          .bind(bucket)
          .run();
      await db
        .prepare(
          "INSERT INTO review_rate_limits (bucket_key_hash, window_start, attempt_count, blocked_until) VALUES (?, ?, ?, ?)",
        )
        .bind(bucket, now, 1, null)
        .run();
      return 1;
    }
    const count = rl.attempt_count + 1;
    await db
      .prepare(
        "UPDATE review_rate_limits SET attempt_count = attempt_count + 1, blocked_until = ? WHERE bucket_key_hash = ?",
      )
      .bind(count >= 5 ? now + 600_000 : rl.blocked_until, bucket)
      .run();
    return count;
  };
  const g = await db
    .prepare("SELECT * FROM share_grants WHERE token_hash = ?")
    .bind(tokenHash)
    .first<GrantRow>();
  if (!g) {
    await bump();
    throw err("INVALID_REVIEW_CREDENTIAL", "Invalid review link or PIN.");
  }
  try {
    await assertGrantUsable(db, g);
  } catch (e) {
    await bump();
    throw e;
  }
  if (g.pin_blocked_until && g.pin_blocked_until > now)
    throw err("RATE_LIMITED", "Too many PIN attempts. Try again later.");
  if (g.pin_hash) {
    if (!req.pin || !(await verifySecret(req.pin, g.pin_hash))) {
      const attempts = g.failed_pin_attempts + 1;
      await db
        .prepare(
          "UPDATE share_grants SET failed_pin_attempts = ?, pin_blocked_until = ? WHERE id = ?",
        )
        .bind(attempts, attempts >= 5 ? now + 600_000 : null, g.id)
        .run();
      await bump();
      throw err("INVALID_REVIEW_CREDENTIAL", "Invalid review link or PIN.");
    }
  }
  await bump();
  const sessionToken = randomToken(32);
  const sessionHash = await sha256Hex(sessionToken);
  const expiresAt = Math.min(g.expires_at, now + 3_600_000);
  await db
    .prepare(
      "INSERT INTO review_sessions (id, grant_id, session_hash, expires_at, revoked_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(newId("rvs"), g.id, sessionHash, expiresAt, null, now)
    .run();
  return { briefId: g.brief_id, expiresAt: toIso(expiresAt), sessionToken, grantId: g.id };
}
export async function resolveReviewSession(db: Db, sessionToken: string) {
  const hash = await sha256Hex(sessionToken);
  const s = await db
    .prepare("SELECT * FROM review_sessions WHERE session_hash = ?")
    .bind(hash)
    .first<{ id: string; grant_id: string; expires_at: number; revoked_at: number | null }>();
  if (!s || s.revoked_at || s.expires_at <= nowMs())
    throw err("INVALID_REVIEW_CREDENTIAL", "Review session is invalid or expired.");
  const g = await db
    .prepare("SELECT * FROM share_grants WHERE id = ?")
    .bind(s.grant_id)
    .first<GrantRow>();
  if (!g) throw err("INVALID_REVIEW_CREDENTIAL", "Review session is invalid or expired.");
  const brief = await assertGrantUsable(db, g);
  return { session: s, grant: g, brief };
}
export async function buildRedactedBrief(db: Db, grant: GrantRow): Promise<RedactedBrief> {
  const briefRow = await getBriefRow(db, grant.brief_id);
  const brief = await toBrief(db, briefRow);
  const include = Boolean(grant.include_measurements);
  const permitted = new Set(JSON.parse(grant.permitted_asset_ids_json) as string[]);
  const review = await deriveReview(db, briefRow);
  const omitted: RedactedBrief["omittedSections"] = include
    ? []
    : ["measurements", "materials", "decisions", "assumptions", "questions"];
  return {
    schemaVersion: 1,
    briefId: brief.id,
    briefNumber: brief.briefNumber,
    contentHash: brief.contentHash,
    finalizedAt: brief.finalizedAt!,
    title: brief.content.title,
    template: brief.content.template,
    assets: brief.assets.filter((a) => permitted.has(a.id)),
    measurements: include ? brief.content.measurements : null,
    constraintStatus: brief.content.constraint.status,
    materials: include
      ? brief.content.materials.map(({ label, quantity }) => ({ label, quantity }))
      : null,
    decisions: include ? brief.content.decisions : null,
    assumptions: include ? brief.content.assumptions : null,
    questions: include
      ? brief.content.questions.map(({ id, text, required }) => ({ id, text, required }))
      : null,
    omittedSections: omitted,
    reviewStatus: review.status,
    disclaimer: brief.content.disclaimer,
  };
}
export async function getReviewSessionView(db: Db, sessionToken: string) {
  const { grant, brief } = await resolveReviewSession(db, sessionToken);
  const redacted = await buildRedactedBrief(db, grant);
  const review = await deriveReview(db, brief);
  const actions = JSON.parse(grant.allowed_actions_json) as string[];
  const content = JSON.parse(brief.content_json) as {
    questions: { required: boolean; resolved: boolean }[];
    constraint: { status: string };
  };
  const blockingReasons: {
    code: string;
    message: string;
    blocks: ("concept" | "finalize" | "accept")[];
  }[] = [];
  if (review.status === "changes_requested")
    blockingReasons.push({
      code: "CHANGES_REQUESTED",
      message: "Changes were requested; a new brief is required.",
      blocks: ["accept"],
    });
  const canApprove =
    actions.includes("approve_design") &&
    review.status !== "changes_requested" &&
    review.status !== "accepted";
  const canVerify = Boolean(grant.include_measurements) && actions.includes("verify_measurements");
  const blockersForAccept = await acceptBlockers(db, brief.id);
  const canAccept =
    actions.includes("accept_brief") &&
    Boolean(grant.include_measurements) &&
    blockersForAccept.length === 0;
  if (!canAccept && actions.includes("accept_brief")) blockingReasons.push(...blockersForAccept);
  void content;
  return {
    grant: {
      id: grant.id,
      expiresAt: toIso(grant.expires_at),
      actions: actions as never,
      includeMeasurements: Boolean(grant.include_measurements),
    },
    brief: redacted,
    capabilities: { canApprove, canVerify, canAccept, blockingReasons },
    reviewerIdentity: {
      method: (grant.pin_hash ? "link_and_pin" : "possession_link") as
        "possession_link" | "link_and_pin",
      verified: false as const,
    },
  };
}
export async function acceptBlockers(
  db: Db,
  briefId: string,
): Promise<{ code: string; message: string; blocks: ("concept" | "finalize" | "accept")[] }[]> {
  const briefRow = await getBriefRow(db, briefId);
  const brief = await toBrief(db, briefRow);
  const review = await deriveReview(db, briefRow);
  const out: { code: string; message: string; blocks: ("concept" | "finalize" | "accept")[] }[] =
    [];
  if (review.status === "changes_requested")
    out.push({
      code: "CHANGES_REQUESTED",
      message: "Changes were requested for this brief.",
      blocks: ["accept"],
    });
  if (
    !review.actions.some((a) => a.action === "approve_design") ||
    review.status === "changes_requested"
  )
    out.push({
      code: "DESIGN_NOT_APPROVED",
      message: "Design approval is required before acceptance.",
      blocks: ["accept"],
    });
  if (review.verifiedMeasurementCount < review.requiredMeasurementCount)
    out.push({
      code: "MISSING_MEASUREMENTS",
      message: "All measurements must be verified for this brief before acceptance.",
      blocks: ["accept"],
    });
  if (brief.content.constraint.status === "insufficient")
    out.push({
      code: "FABRIC_INSUFFICIENT",
      message: "Fabric is insufficient under the reviewed rule.",
      blocks: ["accept"],
    });
  if (brief.content.constraint.status === "unknown")
    out.push({
      code: "FABRIC_UNKNOWN",
      message: "Fabric requirement is unknown. Tailor estimate required.",
      blocks: ["accept"],
    });
  if (brief.content.questions.some((q) => q.required && !q.resolved))
    out.push({
      code: "BRIEF_BLOCKED",
      message: "Required questions are unresolved.",
      blocks: ["accept"],
    });
  return out;
}
export async function submitReviewAction(
  db: Db,
  sessionToken: string,
  key: string,
  req: {
    briefId: string;
    expectedContentHash: string;
    action: string;
    reviewerName: string;
    note?: string | undefined;
    verifications?:
      | { measurementId: string; valueMm: number; method: "in_person_tape" | "reviewed_record" }[]
      | undefined;
  },
) {
  const { session, grant, brief } = await resolveReviewSession(db, sessionToken);
  const requestHashPayload = { ...req };
  const existing = await db
    .prepare("SELECT * FROM review_actions WHERE session_id = ? AND idempotency_key = ?")
    .bind(session.id, key)
    .first<{
      id: string;
      request_hash: string;
      action: string;
      reviewer_name: string;
      credential_type: string;
      note: string | null;
      created_at: number;
    }>();
  if (existing) {
    const { hashPayload } = await import("./util");
    if (existing.request_hash !== (await hashPayload(requestHashPayload)))
      throw err(
        "IDEMPOTENCY_CONFLICT",
        "This Idempotency-Key was already used with a different request.",
      );
    const action: ReviewAction = {
      id: existing.id,
      briefId: brief.id,
      action: existing.action as ReviewAction["action"],
      reviewerName: existing.reviewer_name,
      credentialType: existing.credential_type as ReviewAction["credentialType"],
      identityVerified: false,
      note: existing.note,
      createdAt: toIso(existing.created_at),
    };
    const view = await getReviewSessionView(db, sessionToken);
    return {
      action,
      review: {
        status: (await deriveReview(db, brief)).status,
        requiredMeasurementCount: (await deriveReview(db, brief)).requiredMeasurementCount,
        verifiedMeasurementCount: (await deriveReview(db, brief)).verifiedMeasurementCount,
      },
      capabilities: view.capabilities,
      replayed: true,
    };
  }
  if (req.briefId !== brief.id || req.expectedContentHash !== brief.content_hash) throw conflict();
  const actions = JSON.parse(grant.allowed_actions_json) as string[];
  if (!actions.includes(req.action))
    throw err("FORBIDDEN", "This action is not permitted by the review link.");
  if (
    (req.action === "verify_measurements" || req.action === "accept_brief") &&
    !grant.include_measurements
  )
    throw err("FORBIDDEN", "Measurements are not shared with this review link.");
  if (req.action === "request_changes" && !req.note?.trim())
    throw err("INVALID_INPUT", "request_changes requires a note.");
  const review = await deriveReview(db, brief);
  if (
    (req.action === "approve_design" || req.action === "accept_brief") &&
    review.status === "changes_requested"
  )
    throw conflict();
  if (req.action === "accept_brief") {
    const blockers = await acceptBlockers(db, brief.id);
    if (blockers.length) throw err("BRIEF_BLOCKED", blockers[0]!.message);
  }
  const attestations: { measurementId: string; valueMm: number; method: string; kind: string }[] =
    [];
  if (req.action === "verify_measurements") {
    if (!req.verifications?.length)
      throw err("INVALID_INPUT", "verify_measurements requires at least one verification.");
    for (const v of req.verifications) {
      const m = await db
        .prepare("SELECT * FROM revision_measurements WHERE id = ? AND revision_id = ?")
        .bind(v.measurementId, brief.revision_id)
        .first<{ value_mm: number | null; source: string; kind: string }>();
      if (!m) throw err("INVALID_INPUT", "Measurement does not belong to this brief.");
      if (m.source === "experimental_photo_estimate")
        throw err(
          "INVALID_INPUT",
          "Photo estimates cannot be verified; enter a manual measurement first.",
        );
      if (m.value_mm === null || m.value_mm !== v.valueMm)
        throw err(
          "INVALID_INPUT",
          "Verification value must exactly match the recorded measurement for this brief.",
        );
      attestations.push({
        measurementId: v.measurementId,
        valueMm: v.valueMm,
        method: v.method,
        kind: m.kind,
      });
    }
  }
  const { hashPayload } = await import("./util");
  const actionId = newId("rva");
  const now = nowMs();
  await db.batch([
    db
      .prepare(
        "INSERT INTO review_actions (id, brief_id, grant_id, session_id, action, expected_content_hash, reviewer_name, credential_type, reviewer_user_id, note, idempotency_key, request_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        actionId,
        brief.id,
        grant.id,
        session.id,
        req.action,
        req.expectedContentHash,
        req.reviewerName,
        grant.pin_hash ? "link_and_pin" : "possession_link",
        null,
        req.note ?? null,
        key,
        await hashPayload(requestHashPayload),
        now,
      ),
    ...attestations.map((t) =>
      db
        .prepare(
          "INSERT INTO measurement_attestations (id, review_action_id, measurement_id, value_mm, kind, method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(newId("att"), actionId, t.measurementId, t.valueMm, t.kind, t.method, now),
    ),
  ]);
  const action: ReviewAction = {
    id: actionId,
    briefId: brief.id,
    action: req.action as ReviewAction["action"],
    reviewerName: req.reviewerName,
    credentialType: grant.pin_hash ? "link_and_pin" : "possession_link",
    identityVerified: false,
    note: req.note ?? null,
    createdAt: toIso(now),
  };
  const fresh = await deriveReview(db, brief);
  const view = await getReviewSessionView(db, sessionToken);
  return {
    action,
    review: {
      status: fresh.status,
      requiredMeasurementCount: fresh.requiredMeasurementCount,
      verifiedMeasurementCount: fresh.verifiedMeasurementCount,
    },
    capabilities: view.capabilities,
    replayed: false,
  };
}
export async function logoutReview(db: Db, sessionToken: string) {
  const hash = await sha256Hex(sessionToken);
  await db
    .prepare(
      "UPDATE review_sessions SET revoked_at = ? WHERE session_hash = ? AND revoked_at IS NULL",
    )
    .bind(nowMs(), hash)
    .run();
  return { ok: true as const };
}
