import type { Db } from "./db";
import { conflict, err, newId, notFound } from "./errors";
import { hashPayload, nowMs, toIso } from "./util";
import { checkReceipt, storeReceipt } from "./receipts";
import { emptyProjectInput, type ProjectInput } from "../contracts";

export interface ProjectRow {
  id: string;
  owner_user_id: string;
  title: string;
  status: string;
  current_revision_id: string | null;
  latest_brief_id: string | null;
  version: number;
  updated_at: number;
  deleted_at: number | null;
}
export interface DraftRow {
  project_id: string;
  version: number;
  base_revision_id: string | null;
  input_json: string;
  updated_at: number;
}
export interface RevisionRow {
  id: string;
  project_id: string;
  revision_number: number;
  input_json: string;
  input_hash: string;
  created_at: number;
}

export async function getOwnedProject(
  db: Db,
  userId: string,
  projectId: string,
): Promise<ProjectRow> {
  const p = await db
    .prepare("SELECT * FROM tailor_projects WHERE id = ? AND owner_user_id = ?")
    .bind(projectId, userId)
    .first<ProjectRow>();
  if (!p || p.status === "deleted" || p.status === "deleting") throw notFound();
  return p;
}
export async function getDraft(db: Db, projectId: string): Promise<DraftRow> {
  const d = await db
    .prepare("SELECT * FROM project_drafts WHERE project_id = ?")
    .bind(projectId)
    .first<DraftRow>();
  if (!d) throw notFound();
  return d;
}
export const toRevision = (r: RevisionRow) => ({
  id: r.id,
  projectId: r.project_id,
  number: r.revision_number,
  input: JSON.parse(r.input_json) as ProjectInput,
  inputHash: r.input_hash,
  createdAt: toIso(r.created_at),
});

export async function createProject(
  db: Db,
  userId: string,
  key: string,
  req: {
    title: string;
    template: { id: string; version: number };
    occasion: string | null;
    deadline: string | null;
    fit: "regular" | "relaxed" | "fitted";
    timezone: string;
  },
) {
  const replay = await checkReceipt(db, userId, "create_project", key, req);
  if (replay)
    return {
      detail: replay.response as Awaited<ReturnType<typeof getProjectDetail>>,
      replayed: true,
    };
  const id = newId("prj");
  const now = nowMs();
  const input: ProjectInput = {
    ...emptyProjectInput(req.title, req.timezone),
    template: req.template,
    overview: {
      title: req.title,
      occasion: req.occasion,
      deadline: req.deadline,
      timezone: req.timezone,
      fit: req.fit,
      notes: "",
    },
  };
  await db.batch([
    db
      .prepare(
        "INSERT INTO tailor_projects (id, owner_user_id, title, status, current_revision_id, latest_brief_id, version, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(id, userId, req.title, "active", null, null, 1, now, now, null),
    db
      .prepare(
        "INSERT INTO project_drafts (project_id, version, base_revision_id, input_json, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(id, 1, null, JSON.stringify(input), now),
  ]);
  const detail = await getProjectDetail(db, userId, id);
  await storeReceipt(db, userId, "create_project", key, req, detail);
  return { detail, replayed: false };
}
export async function getProjectDetail(db: Db, userId: string, projectId: string) {
  const p = await getOwnedProject(db, userId, projectId);
  const d = await getDraft(db, projectId);
  let currentRevision = null;
  if (p.current_revision_id) {
    const r = await db
      .prepare("SELECT * FROM project_revisions WHERE id = ? AND project_id = ?")
      .bind(p.current_revision_id, projectId)
      .first<RevisionRow>();
    if (r) currentRevision = toRevision(r);
  }
  let latestBriefSummary = null;
  if (p.latest_brief_id) {
    const b = await db
      .prepare("SELECT * FROM brief_revisions WHERE id = ?")
      .bind(p.latest_brief_id)
      .first<{
        id: string;
        brief_number: number;
        state: string;
        created_at: number;
        finalized_at: number | null;
      }>();
    if (b)
      latestBriefSummary = {
        id: b.id,
        briefNumber: b.brief_number,
        state: b.state,
        reviewStatus: "awaiting_review" as const,
        createdAt: toIso(b.created_at),
        finalizedAt: b.finalized_at ? toIso(b.finalized_at) : null,
      };
  }
  return {
    project: {
      id: p.id,
      title: p.title,
      status: p.status as "active" | "archived",
      version: p.version,
      currentRevisionId: p.current_revision_id,
      latestBriefId: p.latest_brief_id,
      updatedAt: toIso(p.updated_at),
    },
    draft: {
      version: d.version,
      baseRevisionId: d.base_revision_id,
      input: JSON.parse(d.input_json) as ProjectInput,
    },
    currentRevision,
    latestJob: null,
    latestBriefSummary,
  };
}
export async function listProjects(
  db: Db,
  userId: string,
  opts: { status?: string; limit?: number } = {},
) {
  const status = opts.status ?? "all";
  const { results } =
    status === "all" || status === "active" || status === "archived"
      ? await (status === "all"
          ? db
              .prepare(
                "SELECT * FROM tailor_projects WHERE owner_user_id = ? AND status <> ? AND status <> ? ORDER BY updated_at DESC, id DESC LIMIT ?",
              )
              .bind(userId, "deleted", "deleting", opts.limit ?? 20)
              .all<ProjectRow>()
          : db
              .prepare(
                "SELECT * FROM tailor_projects WHERE owner_user_id = ? AND status = ? ORDER BY updated_at DESC, id DESC LIMIT ?",
              )
              .bind(userId, status, opts.limit ?? 20)
              .all<ProjectRow>())
      : { results: [] as ProjectRow[] };
  return {
    items: results.map((p) => ({
      id: p.id,
      title: p.title,
      templateName: null,
      thumbnailAssetId: null,
      status: (p.status === "archived" ? "archived" : "active") as "active" | "archived",
      reviewStatus: null,
      currentRevisionNumber: null,
      updatedAt: toIso(p.updated_at),
    })),
    nextCursor: null,
  };
}
/** CAS draft save: stale version => REVISION_CONFLICT, never silent merge. Also bumps project version. */
export async function saveDraft(
  db: Db,
  userId: string,
  projectId: string,
  req: { expectedDraftVersion: number; input: ProjectInput },
) {
  const p = await getOwnedProject(db, userId, projectId);
  if (p.status === "archived") throw err("INVALID_INPUT", "Archived projects cannot be edited.");
  const now = nowMs();
  const res = await db
    .prepare(
      "UPDATE project_drafts SET input_json = ?, version = version + 1, updated_at = ? WHERE project_id = ? AND version = ?",
    )
    .bind(JSON.stringify(req.input), now, projectId, req.expectedDraftVersion)
    .run();
  if (!res.changes) {
    const d = await getDraft(db, projectId);
    throw conflict(d.version);
  }
  await db
    .prepare(
      "UPDATE tailor_projects SET title = ?, version = version + 1, updated_at = ? WHERE id = ?",
    )
    .bind(req.input.overview.title, now, projectId)
    .run();
  const fresh = await getOwnedProject(db, userId, projectId);
  return {
    draftVersion: req.expectedDraftVersion + 1,
    projectVersion: fresh.version,
    savedAt: toIso(now),
  };
}
export async function freezeRevision(
  db: Db,
  userId: string,
  projectId: string,
  key: string,
  req: { expectedDraftVersion: number; expectedProjectVersion: number },
) {
  const payload = { projectId, ...req };
  const replay = await checkReceipt(db, userId, "create_revision", key, payload);
  if (replay)
    return {
      ...(replay.response as { revision: ReturnType<typeof toRevision>; projectVersion: number }),
      replayed: true as const,
      reused: false,
    };
  const p = await getOwnedProject(db, userId, projectId);
  const d = await getDraft(db, projectId);
  if (d.version !== req.expectedDraftVersion) throw conflict(d.version);
  if (p.version !== req.expectedProjectVersion) throw conflict(p.version);
  const input = JSON.parse(d.input_json) as ProjectInput;
  const inputHash = await hashPayload(input);
  if (p.current_revision_id) {
    const cur = await db
      .prepare("SELECT * FROM project_revisions WHERE id = ?")
      .bind(p.current_revision_id)
      .first<RevisionRow>();
    if (cur && cur.input_hash === inputHash) {
      const result = { revision: toRevision(cur), projectVersion: p.version };
      await storeReceipt(db, userId, "create_revision", key, payload, result);
      return { ...result, replayed: false, reused: true };
    }
  }
  const { results } = await db
    .prepare(
      "SELECT * FROM project_revisions WHERE project_id = ? ORDER BY revision_number DESC LIMIT 1",
    )
    .bind(projectId)
    .all<RevisionRow>();
  const number = (results[0]?.revision_number ?? 0) + 1;
  const revId = newId("rev");
  const now = nowMs();
  const stmts = [
    db
      .prepare(
        "INSERT INTO project_revisions (id, project_id, revision_number, draft_version, template_id, template_version, input_json, input_hash, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        revId,
        projectId,
        number,
        d.version,
        input.template?.id ?? null,
        input.template?.version ?? null,
        JSON.stringify(input),
        inputHash,
        userId,
        now,
      ),
    ...input.measurements.map((mm) =>
      db
        .prepare(
          "INSERT INTO revision_measurements (id, revision_id, name, kind, value_mm, entered_value, entered_unit, source, source_asset_id, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          newId("msr"),
          revId,
          mm.name,
          mm.kind,
          mm.valueMm,
          mm.enteredValue,
          mm.enteredUnit,
          mm.source,
          mm.sourceAssetId,
          now,
        ),
    ),
    db
      .prepare(
        "UPDATE tailor_projects SET current_revision_id = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
      )
      .bind(revId, now, projectId, req.expectedProjectVersion),
    db
      .prepare("UPDATE project_drafts SET base_revision_id = ? WHERE project_id = ?")
      .bind(revId, projectId),
  ];
  await db.batch(stmts);
  const row = await db
    .prepare("SELECT * FROM project_revisions WHERE id = ?")
    .bind(revId)
    .first<RevisionRow>();
  const fresh = await getOwnedProject(db, userId, projectId);
  const result = { revision: toRevision(row!), projectVersion: fresh.version };
  await storeReceipt(db, userId, "create_revision", key, payload, result);
  return { ...result, replayed: false, reused: false };
}
export async function getRevision(db: Db, userId: string, projectId: string, revisionId: string) {
  await getOwnedProject(db, userId, projectId);
  const r = await db
    .prepare("SELECT * FROM project_revisions WHERE id = ? AND project_id = ?")
    .bind(revisionId, projectId)
    .first<RevisionRow>();
  if (!r) throw notFound();
  return toRevision(r);
}
export async function archiveProject(
  db: Db,
  userId: string,
  projectId: string,
  key: string,
  req: { expectedProjectVersion: number; archived: boolean },
) {
  const payload = { projectId, ...req };
  const replay = await checkReceipt(db, userId, "archive_project", key, payload);
  if (replay) return replay.response;
  const now = nowMs();
  const res = await db
    .prepare(
      "UPDATE tailor_projects SET status = ?, version = version + 1, updated_at = ? WHERE id = ? AND owner_user_id = ? AND version = ?",
    )
    .bind(req.archived ? "archived" : "active", now, projectId, userId, req.expectedProjectVersion)
    .run();
  if (!res.changes) {
    const p = await db
      .prepare("SELECT * FROM tailor_projects WHERE id = ? AND owner_user_id = ?")
      .bind(projectId, userId)
      .first<ProjectRow>();
    if (!p) throw notFound();
    throw conflict(p.version);
  }
  const detail = await getProjectDetail(db, userId, projectId);
  await storeReceipt(db, userId, "archive_project", key, payload, detail);
  return detail;
}
/** Tombstone: access blocked immediately, shares revoked, cleanup tracked. */
export async function deleteProject(
  db: Db,
  userId: string,
  projectId: string,
  key: string,
  req: { expectedProjectVersion: number },
) {
  const payload = { projectId, ...req };
  const replay = await checkReceipt(db, userId, "delete_project", key, payload);
  if (replay)
    return replay.response as { projectId: string; status: "deleting"; cleanupId: string };
  const p = await getOwnedProject(db, userId, projectId);
  if (p.version !== req.expectedProjectVersion) throw conflict(p.version);
  const now = nowMs();
  const cleanupId = newId("cln");
  await db
    .prepare(
      "UPDATE share_grants SET revoked_at = ? WHERE owner_user_id = ? AND revoked_at IS NULL AND brief_id IN (SELECT id FROM brief_revisions WHERE project_id = ?)",
    )
    .bind(now, userId, projectId)
    .run()
    .catch(() => undefined);
  // FakeDb has no subqueries; revoke via brief loop as fallback/primary path:
  const { results: briefs } = await db
    .prepare("SELECT * FROM brief_revisions WHERE project_id = ?")
    .bind(projectId)
    .all<{ id: string }>();
  for (const b of briefs)
    await db
      .prepare("UPDATE share_grants SET revoked_at = ? WHERE brief_id = ? AND revoked_at IS NULL")
      .bind(now, b.id)
      .run();
  await db.batch([
    db
      .prepare(
        "UPDATE tailor_projects SET status = ?, deleted_at = ?, version = version + 1, updated_at = ? WHERE id = ?",
      )
      .bind("deleting", now, now, projectId),
    db
      .prepare(
        "INSERT INTO cleanup_tasks (id, project_id, target_type, target_ref, state, attempt_count, next_attempt_at, last_error_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        cleanupId,
        projectId,
        "project_metadata",
        `project:${projectId}`,
        "pending",
        0,
        null,
        null,
        now,
        now,
      ),
  ]);
  const result = { projectId, status: "deleting" as const, cleanupId };
  await storeReceipt(db, userId, "delete_project", key, payload, result);
  return result;
}
/** Test/internal helper: insert an asset row (real upload pipeline is G1-blocked). */
export async function insertAsset(
  db: Db,
  a: {
    id: string;
    projectId: string;
    ownerUserId: string;
    kind: string;
    mime: string;
    bytes: number;
    widthPx: number;
    heightPx: number;
    parentAssetId?: string | null;
  },
) {
  const now = nowMs();
  await db
    .prepare(
      "INSERT INTO assets (id, project_id, owner_user_id, kind, object_key, mime, bytes, width_px, height_px, sha256, parent_asset_id, consent_id, origin_job_id, state, retention_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      a.id,
      a.projectId,
      a.ownerUserId,
      a.kind,
      `private/${a.projectId}/${a.id}`,
      a.mime,
      a.bytes,
      a.widthPx,
      a.heightPx,
      "0".repeat(64),
      a.parentAssetId ?? null,
      null,
      null,
      "ready",
      null,
      now,
      now,
    )
    .run();
}
