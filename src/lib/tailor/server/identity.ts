import type { Db } from "./db";
import { err, newId, notFound, conflict } from "./errors";
import { nowMs, toIso } from "./util";
import { checkReceipt, storeReceipt } from "./receipts";
import type { TailorConfig } from "./config";

export interface VerifiedActor {
  subject: string;
  displayName: string;
  email: string;
}
export interface LocalUser {
  userId: string;
}

/** Concurrent idempotent mapping: unique (provider,subject) wins; loser re-reads. No email-only claiming. */
export async function ensureLocalUser(db: Db, actor: VerifiedActor): Promise<LocalUser> {
  const existing = await db
    .prepare("SELECT * FROM auth_identities WHERE provider = ? AND subject = ?")
    .bind("clerk", actor.subject)
    .first<{ user_id: string }>();
  if (existing) {
    await assertActive(db, existing.user_id);
    return { userId: existing.user_id };
  }
  const userId = newId("usr");
  const now = nowMs();
  try {
    await db.batch([
      db
        .prepare("INSERT INTO app_users (id, status, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .bind(userId, "active", now, now),
      db
        .prepare(
          "INSERT INTO auth_identities (id, user_id, provider, subject, link_method, link_audit_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(newId("aid"), userId, "clerk", actor.subject, "verified_signin", null, now),
      db
        .prepare(
          "INSERT INTO user_preferences (user_id, measurement_unit, timezone, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(userId, "cm", "Africa/Accra", 1, now, now),
      db
        .prepare(
          "INSERT INTO credit_accounts (user_id, balance, reserved, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(userId, 0, 0, 1, now, now),
    ]);
    return { userId };
  } catch {
    const again = await db
      .prepare("SELECT * FROM auth_identities WHERE provider = ? AND subject = ?")
      .bind("clerk", actor.subject)
      .first<{ user_id: string }>();
    if (again) return { userId: again.user_id };
    throw err("FEATURE_UNAVAILABLE", "Identity provisioning failed.");
  }
}
export async function assertActive(db: Db, userId: string) {
  const u = await db
    .prepare("SELECT * FROM app_users WHERE id = ?")
    .bind(userId)
    .first<{ status: string }>();
  if (!u) throw notFound();
  if (u.status !== "active") throw err("FORBIDDEN", "Account is not active.");
}
export async function getPreferences(db: Db, userId: string) {
  const p = await db
    .prepare("SELECT * FROM user_preferences WHERE user_id = ?")
    .bind(userId)
    .first<{ measurement_unit: string; timezone: string; version: number }>();
  if (!p) throw notFound();
  return {
    measurementUnit: p.measurement_unit as "cm" | "in",
    timezone: p.timezone,
    version: p.version,
  };
}
export async function updatePreferences(
  db: Db,
  userId: string,
  req: { expectedVersion: number; measurementUnit: "cm" | "in"; timezone: string },
) {
  const res = await db
    .prepare(
      "UPDATE user_preferences SET measurement_unit = ?, timezone = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND version = ?",
    )
    .bind(req.measurementUnit, req.timezone, nowMs(), userId, req.expectedVersion)
    .run();
  if (!res.changes) {
    const cur = await getPreferences(db, userId);
    throw conflict(cur.version);
  }
  return getPreferences(db, userId);
}
export async function getMe(db: Db, userId: string, actor: VerifiedActor, config: TailorConfig) {
  const acct = await db
    .prepare("SELECT * FROM credit_accounts WHERE user_id = ?")
    .bind(userId)
    .first<{ balance: number; reserved: number }>();
  return {
    user: { id: userId, displayName: actor.displayName, email: actor.email },
    preferences: await getPreferences(db, userId),
    credits: {
      available: (acct?.balance ?? 0) - (acct?.reserved ?? 0),
      reserved: acct?.reserved ?? 0,
    },
    capabilities: config.capabilities,
    policy: { version: config.policyVersion, personRetentionDays: config.personRetentionDays },
    jobQuotes: config.jobQuotes,
  };
}

// ---- Consents ----
export interface ConsentRow {
  id: string;
  user_id: string;
  project_id: string | null;
  purpose: string;
  policy_version: string;
  scope_json: string;
  granted_at: number;
  withdrawn_at: number | null;
}
export const toConsent = (r: ConsentRow) => ({
  id: r.id,
  purpose: r.purpose as never,
  policyVersion: r.policy_version,
  projectId: r.project_id,
  grantedAt: toIso(r.granted_at),
  withdrawnAt: r.withdrawn_at ? toIso(r.withdrawn_at) : null,
});

export async function listConsents(db: Db, userId: string) {
  const { results } = await db
    .prepare("SELECT * FROM consents WHERE user_id = ? ORDER BY granted_at DESC")
    .bind(userId)
    .all<ConsentRow>();
  return results.map(toConsent);
}
export async function createConsent(
  db: Db,
  userId: string,
  key: string,
  req: {
    purpose: string;
    policyVersion: string;
    projectId?: string | undefined;
    assetIds?: string[] | undefined;
  },
) {
  const replay = await checkReceipt(db, userId, "create_consent", key, req);
  if (replay) return { consent: replay.response as ReturnType<typeof toConsent>, replayed: true };
  if (req.projectId) {
    const p = await db
      .prepare("SELECT * FROM tailor_projects WHERE id = ? AND owner_user_id = ?")
      .bind(req.projectId, userId)
      .first();
    if (!p) throw notFound();
  }
  const id = newId("cns");
  const now = nowMs();
  const scope = { assetIds: req.assetIds ?? [], projectId: req.projectId ?? null };
  await db
    .prepare(
      "INSERT INTO consents (id, user_id, project_id, purpose, policy_version, scope_json, granted_at, withdrawn_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      userId,
      req.projectId ?? null,
      req.purpose,
      req.policyVersion,
      JSON.stringify(scope),
      now,
      null,
      now,
    )
    .run();
  const row = await db.prepare("SELECT * FROM consents WHERE id = ?").bind(id).first<ConsentRow>();
  const consent = toConsent(row!);
  await storeReceipt(db, userId, "create_consent", key, req, consent);
  return { consent, replayed: false };
}
export async function getActiveConsent(
  db: Db,
  userId: string,
  consentId: string,
  purpose?: string,
): Promise<ConsentRow> {
  const row = await db
    .prepare("SELECT * FROM consents WHERE id = ? AND user_id = ?")
    .bind(consentId, userId)
    .first<ConsentRow>();
  if (!row || row.withdrawn_at)
    throw err("CONSENT_REQUIRED", "An active consent is required for this action.");
  if (purpose && row.purpose !== purpose)
    throw err("CONSENT_REQUIRED", "Consent purpose does not cover this action.");
  return row;
}
export async function withdrawConsent(db: Db, userId: string, consentId: string, key: string) {
  const payload = { consentId };
  const replay = await checkReceipt(db, userId, "withdraw_consent", key, payload);
  if (replay)
    return replay.response as { consent: ReturnType<typeof toConsent>; cleanupScheduled: boolean };
  const row = await db
    .prepare("SELECT * FROM consents WHERE id = ? AND user_id = ?")
    .bind(consentId, userId)
    .first<ConsentRow>();
  if (!row) throw notFound();
  let cleanupScheduled = false;
  if (!row.withdrawn_at) {
    const now = nowMs();
    await db
      .prepare("UPDATE consents SET withdrawn_at = ? WHERE id = ?")
      .bind(now, consentId)
      .run();
    // Revoke dependent share grants immediately; schedule cleanup for the consent scope.
    await db
      .prepare("UPDATE share_grants SET revoked_at = ? WHERE consent_id = ? AND revoked_at IS NULL")
      .bind(now, consentId)
      .run();
    if (row.project_id) {
      await db
        .prepare(
          "INSERT INTO cleanup_tasks (id, project_id, target_type, target_ref, state, attempt_count, next_attempt_at, last_error_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          newId("cln"),
          row.project_id,
          "project_metadata",
          `consent:${consentId}`,
          "pending",
          0,
          null,
          null,
          now,
          now,
        )
        .run()
        .catch(() => undefined);
      cleanupScheduled = true;
    }
  }
  const fresh = await db
    .prepare("SELECT * FROM consents WHERE id = ?")
    .bind(consentId)
    .first<ConsentRow>();
  const result = { consent: toConsent(fresh!), cleanupScheduled };
  await storeReceipt(db, userId, "withdraw_consent", key, payload, result);
  return result;
}
