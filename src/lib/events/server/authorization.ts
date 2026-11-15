import type { Db } from "@/lib/tailor/server/db";
import { err, newId } from "@/lib/tailor/server/errors";
import { nowMs } from "@/lib/tailor/server/util";
import { mapDatabaseError } from "./store";

export type PlatformRole = "events_editor" | "platform_admin";

export interface StaffActor {
  userId: string;
  role: PlatformRole;
}

/** Active grant lookup. Revocation applies to the next request, no cache. */
export async function staffRole(db: Db, userId: string): Promise<PlatformRole | null> {
  const row = await db
    .prepare(
      "SELECT role FROM platform_role_grants WHERE user_id = ? AND revoked_at IS NULL ORDER BY CASE role WHEN 'platform_admin' THEN 0 ELSE 1 END LIMIT 1",
    )
    .bind(userId)
    .first<{ role: PlatformRole }>();
  return row?.role ?? null;
}

export async function requireStaff(db: Db, userId: string): Promise<StaffActor> {
  const role = await staffRole(db, userId);
  if (!role) throw err("FORBIDDEN", "This area is for Fashley event staff.");
  return { userId, role };
}

export async function requirePlatformAdmin(db: Db, userId: string): Promise<StaffActor> {
  const actor = await requireStaff(db, userId);
  if (actor.role !== "platform_admin")
    throw err("FORBIDDEN", "Only a platform admin can change staff access.");
  return actor;
}

export async function listStaff(db: Db) {
  const { results } = await db
    .prepare(
      "SELECT g.*, i.email FROM platform_role_grants g LEFT JOIN user_emails i ON i.user_id = g.user_id WHERE g.revoked_at IS NULL ORDER BY g.created_at DESC",
    )
    .all<{
      id: string;
      user_id: string;
      role: PlatformRole;
      created_at: number;
      email: string | null;
    }>();
  return results.map((r) => ({
    id: r.id,
    userId: r.user_id,
    role: r.role,
    email: r.email,
    grantedAt: new Date(r.created_at).toISOString(),
  }));
}

export async function grantStaffRole(
  db: Db,
  actor: StaffActor,
  input: { userId: string; role: PlatformRole },
) {
  const now = nowMs();
  const existing = await db
    .prepare("SELECT * FROM platform_role_grants WHERE user_id = ? AND role = ?")
    .bind(input.userId, input.role)
    .first<{ id: string; revoked_at: number | null }>();
  if (existing) {
    if (!existing.revoked_at) return { id: existing.id, created: false };
    await db
      .prepare("UPDATE platform_role_grants SET revoked_at = NULL WHERE id = ?")
      .bind(existing.id)
      .run();
    await audit(db, actor.userId, "staff.grant", "platform_role_grant", existing.id, {
      role: input.role,
      userId: input.userId,
    });
    return { id: existing.id, created: false };
  }
  const id = newId("rol");
  await db
    .prepare(
      "INSERT INTO platform_role_grants (id, user_id, role, granted_by, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, NULL)",
    )
    .bind(id, input.userId, input.role, actor.userId, now)
    .run();
  await audit(db, actor.userId, "staff.grant", "platform_role_grant", id, {
    role: input.role,
    userId: input.userId,
  });
  return { id, created: true };
}

export async function revokeStaffRole(db: Db, actor: StaffActor, grantId: string) {
  const grant = await db
    .prepare("SELECT * FROM platform_role_grants WHERE id = ?")
    .bind(grantId)
    .first<{ id: string; user_id: string; role: PlatformRole; revoked_at: number | null }>();
  if (!grant || grant.revoked_at) throw err("NOT_FOUND", "That staff grant is not active.");
  if (grant.role === "platform_admin") {
    // Never leave the platform without an admin.
    const admins = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM platform_role_grants WHERE role = 'platform_admin' AND revoked_at IS NULL",
      )
      .first<{ count: number }>();
    if ((admins?.count ?? 0) <= 1)
      throw err("FORBIDDEN", "The last platform admin cannot be removed.");
  }
  try {
    await db
      .prepare("UPDATE platform_role_grants SET revoked_at = ? WHERE id = ?")
      .bind(nowMs(), grantId)
      .run();
  } catch (e) {
    mapDatabaseError(e);
  }
  await audit(db, actor.userId, "staff.revoke", "platform_role_grant", grantId, {
    role: grant.role,
    userId: grant.user_id,
  });
  return { ok: true };
}

export async function audit(
  db: Db,
  actorUserId: string | null,
  action: string,
  resourceType: string,
  resourceId: string,
  summary: Record<string, unknown> = {},
) {
  await db
    .prepare(
      "INSERT INTO admin_audit_log (id, actor_user_id, action, resource_type, resource_id, revision_id, request_id, summary_json, created_at) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)",
    )
    .bind(
      newId("aud"),
      actorUserId,
      action,
      resourceType,
      resourceId,
      JSON.stringify(summary),
      nowMs(),
    )
    .run();
}

export async function listAudit(db: Db, limit = 100) {
  const { results } = await db
    .prepare(
      "SELECT a.*, i.email AS actor_email FROM admin_audit_log a LEFT JOIN user_emails i ON i.user_id = a.actor_user_id ORDER BY a.created_at DESC LIMIT ?",
    )
    .bind(Math.min(200, Math.max(1, limit)))
    .all<{
      id: string;
      action: string;
      resource_type: string;
      resource_id: string;
      summary_json: string;
      created_at: number;
      actor_email: string | null;
    }>();
  return results.map((r) => ({
    id: r.id,
    action: r.action,
    resourceType: r.resource_type,
    resourceId: r.resource_id,
    summary: safeJson(r.summary_json),
    actorEmail: r.actor_email,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
