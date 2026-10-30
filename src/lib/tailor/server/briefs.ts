import type { Db } from "./db";
import { conflict, err, newId, notFound } from "./errors";
import { hashPayload, nowMs, toIso } from "./util";
import { checkReceipt, storeReceipt } from "./receipts";
import { evaluateConstraints } from "./constraints";
import { getPublishedTemplate, reviewedRule } from "./templates";
import { getOwnedProject, getRevision } from "./projects";
import type { Brief, BriefContent, MeasurementView, ProjectInput } from "../contracts";

export interface BriefRow {
  id: string;
  project_id: string;
  revision_id: string;
  brief_number: number;
  content_json: string;
  content_hash: string;
  state: string;
  finalized_at: number | null;
  created_at: number;
}

export async function measurementViews(db: Db, brief: BriefRow): Promise<MeasurementView[]> {
  const content = JSON.parse(brief.content_json) as BriefContent;
  const { results: atts } = await db
    .prepare(
      "SELECT * FROM measurement_attestations WHERE measurement_id IN (SELECT id FROM revision_measurements WHERE revision_id = ?)",
    )
    .bind(brief.revision_id)
    .all()
    .catch(() => ({ results: [] as never[] }));
  void atts;
  // Attestations are resolved via review actions on this brief (exact-brief binding), not inherited flags.
  const { results: actions } = await db
    .prepare(
      "SELECT * FROM review_actions WHERE brief_id = ? AND action = ? ORDER BY created_at ASC",
    )
    .bind(brief.id, "verify_measurements")
    .all<{ id: string; reviewer_name: string; created_at: number }>();
  const verified = new Map<string, { actor: string; at: number; method: string }>();
  for (const a of actions) {
    const { results } = await db
      .prepare("SELECT * FROM measurement_attestations WHERE review_action_id = ?")
      .bind(a.id)
      .all<{ measurement_id: string; method: string }>();
    for (const t of results)
      verified.set(t.measurement_id, {
        actor: (await db
          .prepare("SELECT * FROM review_actions WHERE id = ?")
          .bind(a.id)
          .first<{ reviewer_name: string }>())!.reviewer_name,
        at: a.created_at,
        method: t.method,
      });
  }
  const { results: msr } = await db
    .prepare("SELECT * FROM revision_measurements WHERE revision_id = ?")
    .bind(brief.revision_id)
    .all<{ id: string; name: string }>();
  const idByName = new Map(msr.map((m) => [m.name, m.id]));
  return content.inputSnapshot.measurements.map((m) => {
    const mid = idByName.get(m.name);
    const v = mid ? verified.get(mid) : undefined;
    return {
      ...m,
      id: mid ?? `msr_unresolved_${m.name}`,
      verification: v
        ? {
            status: "verified" as const,
            actorName: v.actor,
            method: v.method,
            verifiedAt: toIso(v.at),
          }
        : { status: "unverified" as const, actorName: null, method: null, verifiedAt: null },
    };
  });
}
export async function deriveReview(db: Db, brief: BriefRow) {
  const { results: actions } = await db
    .prepare("SELECT * FROM review_actions WHERE brief_id = ? ORDER BY created_at ASC, id ASC")
    .bind(brief.id)
    .all<{
      id: string;
      action: string;
      reviewer_name: string;
      credential_type: string;
      note: string | null;
      created_at: number;
    }>();
  const views = await measurementViews(db, brief);
  const verifiedCount = views.filter((v) => v.verification.status === "verified").length;
  let status: "awaiting_review" | "changes_requested" | "design_approved" | "accepted" =
    "awaiting_review";
  for (const a of actions) {
    if (a.action === "request_changes") status = "changes_requested";
    else if (a.action === "approve_design" && status !== "changes_requested")
      status = "design_approved";
    else if (a.action === "accept_brief") status = "accepted";
  }
  // accept after a later request_changes must not stay accepted
  const lastChange = [...actions].reverse().find((a) => a.action === "request_changes");
  const lastAccept = [...actions].reverse().find((a) => a.action === "accept_brief");
  if (lastChange && lastAccept && lastChange.created_at >= lastAccept.created_at)
    status = "changes_requested";
  return {
    status,
    requiredMeasurementCount: views.length,
    verifiedMeasurementCount: verifiedCount,
    actions: actions.map((a) => ({
      id: a.id,
      briefId: brief.id,
      action: a.action as never,
      reviewerName: a.reviewer_name,
      credentialType: a.credential_type as never,
      identityVerified: false,
      note: a.note,
      createdAt: toIso(a.created_at),
    })),
  };
}
export async function toBrief(db: Db, row: BriefRow): Promise<Brief> {
  const content = JSON.parse(row.content_json) as BriefContent;
  const views = await measurementViews(db, row);
  const { results: bas } = await db
    .prepare("SELECT * FROM brief_assets WHERE brief_id = ?")
    .bind(row.id)
    .all<{ asset_id: string }>();
  const assets = [];
  for (const ba of bas) {
    const a = await db.prepare("SELECT * FROM assets WHERE id = ?").bind(ba.asset_id).first<{
      id: string;
      project_id: string;
      kind: string;
      mime: never;
      bytes: number;
      width_px: number;
      height_px: number;
      parent_asset_id: string | null;
      created_at: number;
    }>();
    if (a)
      assets.push({
        id: a.id,
        projectId: a.project_id,
        kind: a.kind,
        mime: a.mime,
        bytes: a.bytes,
        widthPx: a.width_px,
        heightPx: a.height_px,
        parentAssetId: a.parent_asset_id,
        createdAt: toIso(a.created_at),
      });
  }
  const checks = evaluateConstraints(content.inputSnapshot, { rule: null });
  return {
    id: row.id,
    projectId: row.project_id,
    revisionId: row.revision_id,
    briefNumber: row.brief_number,
    state: row.state as Brief["state"],
    contentHash: row.content_hash,
    createdAt: toIso(row.created_at),
    finalizedAt: row.finalized_at ? toIso(row.finalized_at) : null,
    content: { ...content, measurements: views },
    assets,
    blockers: checks.blockers,
    review: await deriveReview(db, row),
  };
}
/**
 * Deterministic local assembly from a frozen revision (no model claims). The live assemble_brief
 * job route stays FEATURE_UNAVAILABLE until Workflow/Meta are configured; this service is the
 * locally-verifiable persistence core used by finalize/share/review.
 */
export async function assembleBrief(db: Db, userId: string, projectId: string, revisionId: string) {
  await getOwnedProject(db, userId, projectId);
  const revision = await getRevision(db, userId, projectId, revisionId);
  const input: ProjectInput = revision.input;
  if (!input.template) throw err("BRIEF_BLOCKED", "A template is required before brief assembly.");
  if (!input.selectedConceptAssetId || !input.fabric.selection?.cropAssetId)
    throw err(
      "BRIEF_BLOCKED",
      "A selected concept and fabric crop are required before brief assembly.",
    );
  let rule = null;
  let required: string[] = [];
  let templateName = input.template.id;
  try {
    const t = await getPublishedTemplate(db, input.template.id, input.template.version);
    rule = reviewedRule(t);
    templateName = t.name;
    required = (JSON.parse(t.measurement_schema_json) as { name: string; required: boolean }[])
      .filter((f) => f.required)
      .map((f) => f.name);
  } catch {
    /* unpublished/fixture template: unknown rule */
  }
  const checks = evaluateConstraints(input, {
    rule,
    templateId: input.template.id,
    templateVersion: input.template.version,
    requiredMeasurements: required,
  });
  const content: BriefContent = {
    schemaVersion: 1,
    title: input.overview.title,
    template: { id: input.template.id, version: input.template.version, name: templateName },
    inputSnapshot: input,
    conceptAssetId: input.selectedConceptAssetId,
    fabricAssetId: input.fabric.selection.cropAssetId,
    measurements: input.measurements.map((m, i) => ({
      ...m,
      id: `pending_${i}`,
      verification: { status: "unverified", actorName: null, method: null, verifiedAt: null },
    })),
    constraint: checks.constraint,
    materials: [{ label: "Fabric", quantity: null, source: "user" }],
    decisions: [],
    assumptions: [],
    questions: input.customerQuestions.map((q, i) => ({
      id: `q_${i + 1}`,
      text: q,
      required: true,
      resolved: false,
      source: "user" as const,
    })),
    provenance: {
      modelIds: [],
      promptVersion: "deterministic-assembly-v1",
      ruleVersion: rule?.ruleVersion ?? null,
    },
    disclaimer:
      "Measurements are manual entries unless separately verified by a reviewer for this exact brief. This brief is not a cutting instruction.",
  };
  const contentHash = await hashPayload(content);
  const { results } = await db
    .prepare(
      "SELECT * FROM brief_revisions WHERE project_id = ? ORDER BY brief_number DESC LIMIT 1",
    )
    .bind(projectId)
    .all<BriefRow>();
  const id = newId("brf");
  const now = nowMs();
  const assetIds = [...new Set([input.fabric.selection.cropAssetId, input.selectedConceptAssetId])];
  await db.batch([
    db
      .prepare(
        "INSERT INTO brief_revisions (id, project_id, revision_id, brief_number, assembly_job_id, content_json, content_hash, state, finalized_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        projectId,
        revisionId,
        (results[0]?.brief_number ?? 0) + 1,
        null,
        JSON.stringify(content),
        contentHash,
        "draft",
        null,
        now,
      ),
    ...assetIds.map((aid) =>
      db
        .prepare("INSERT INTO brief_assets (brief_id, asset_id, role) VALUES (?, ?, ?)")
        .bind(id, aid, aid === input.selectedConceptAssetId ? "concept" : "swatch"),
    ),
  ]);
  const row = await db
    .prepare("SELECT * FROM brief_revisions WHERE id = ?")
    .bind(id)
    .first<BriefRow>();
  return toBrief(db, row!);
}
export async function getBriefRow(db: Db, briefId: string): Promise<BriefRow> {
  const r = await db
    .prepare("SELECT * FROM brief_revisions WHERE id = ?")
    .bind(briefId)
    .first<BriefRow>();
  if (!r) throw notFound();
  return r;
}
export async function getOwnedBrief(db: Db, userId: string, briefId: string): Promise<Brief> {
  const row = await getBriefRow(db, briefId);
  await getOwnedProject(db, userId, row.project_id);
  return toBrief(db, row);
}
export async function runChecks(db: Db, userId: string, projectId: string, revisionId: string) {
  const revision = await getRevision(db, userId, projectId, revisionId);
  let rule = null;
  let required: string[] = [];
  if (revision.input.template) {
    try {
      const t = await getPublishedTemplate(
        db,
        revision.input.template.id,
        revision.input.template.version,
      );
      rule = reviewedRule(t);
      required = (JSON.parse(t.measurement_schema_json) as { name: string; required: boolean }[])
        .filter((f) => f.required)
        .map((f) => f.name);
    } catch {
      /* unknown */
    }
  }
  return evaluateConstraints(revision.input, {
    rule,
    templateId: revision.input.template?.id ?? null,
    templateVersion: revision.input.template?.version ?? null,
    requiredMeasurements: required,
  });
}
export async function finalizeBrief(
  db: Db,
  userId: string,
  briefId: string,
  key: string,
  req: {
    expectedProjectVersion: number;
    expectedContentHash: string;
    acknowledgedBlockerCodes: string[];
  },
) {
  const row = await getBriefRow(db, briefId);
  const payload = { briefId, ...req };
  const replay = await checkReceipt(db, userId, "finalize_brief", key, payload);
  if (replay) return replay.response as { brief: Brief; projectVersion: number };
  const project = await getOwnedProject(db, userId, row.project_id);
  if (row.state !== "draft") throw conflict(project.version);
  if (row.content_hash !== req.expectedContentHash) throw conflict(project.version);
  if (project.version !== req.expectedProjectVersion) throw conflict(project.version);
  const now = nowMs();
  const { results: prev } = await db
    .prepare("SELECT * FROM brief_revisions WHERE project_id = ? AND state = ?")
    .bind(row.project_id, "finalized")
    .all<BriefRow>();
  const stmts = [
    db
      .prepare("UPDATE brief_revisions SET state = ?, finalized_at = ? WHERE id = ?")
      .bind("finalized", now, briefId),
    ...prev
      .filter((b) => b.id !== briefId)
      .map((b) =>
        db.prepare("UPDATE brief_revisions SET state = ? WHERE id = ?").bind("superseded", b.id),
      ),
    db
      .prepare(
        "UPDATE tailor_projects SET latest_brief_id = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?",
      )
      .bind(briefId, now, row.project_id, req.expectedProjectVersion),
  ];
  await db.batch(stmts);
  for (const b of prev)
    if (b.id !== briefId)
      await db
        .prepare("UPDATE share_grants SET revoked_at = ? WHERE brief_id = ? AND revoked_at IS NULL")
        .bind(now, b.id)
        .run();
  const fresh = await getBriefRow(db, briefId);
  const result = {
    brief: await toBrief(db, fresh),
    projectVersion: req.expectedProjectVersion + 1,
  };
  await storeReceipt(db, userId, "finalize_brief", key, payload, result);
  return result;
}
