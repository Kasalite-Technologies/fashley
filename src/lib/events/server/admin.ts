import type { Db } from "@/lib/tailor/server/db";
import { err, newId } from "@/lib/tailor/server/errors";
import { nowMs, toIso } from "@/lib/tailor/server/util";
import { audit, type StaffActor } from "./authorization";
import { outboxStatement } from "./notifications";
import {
  availabilityOf,
  buildSearchText,
  mapDatabaseError,
  coverUrlFor,
  latestRevision,
  type EventRow,
  type RevisionRow,
} from "./store";
import type {
  AdminEventDetail,
  AdminEventRow,
  AdminListQuery,
  AdminSortField,
  AdminView,
  EventCard,
  Paginated,
  ReportReason,
} from "@/lib/events/contracts";

const PAGE_SIZE = 25;

function adminRow(row: EventRow, waitlistCount: number, submittedAt: number | null): AdminEventRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    reviewState: row.review_state,
    publication: row.publication,
    lifecycle: row.lifecycle,
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    timezone: row.timezone,
    city: row.city,
    format: row.format,
    category: row.category,
    organizerId: row.organizer_id,
    organizerName: row.organizer_name,
    confirmedCount: row.confirmed_count,
    capacity: row.capacity,
    waitlistCount,
    submittedAt: submittedAt ? toIso(submittedAt) : null,
    updatedAt: toIso(row.updated_at),
  };
}

function sortColumn(field: AdminSortField) {
  switch (field) {
    case "starts_at":
      return "e.starts_at";
    case "submitted_at":
      return "submitted_at";
    case "title":
      return "e.title";
    default:
      return "e.updated_at";
  }
}

export async function listAdminEvents(
  db: Db,
  query: AdminListQuery,
): Promise<Paginated<AdminEventRow>> {
  const where: string[] = ["1 = 1"];
  const params: unknown[] = [];
  const view: AdminView = query.view;
  if (view === "needs_review") where.push("e.review_state = 'submitted'");
  if (view === "changes_requested") where.push("e.review_state = 'changes_requested'");
  if (view === "published") where.push("e.publication = 'published'");
  if (view === "upcoming") {
    where.push("e.starts_at >= ?");
    params.push(nowMs());
  }
  if (view === "past") {
    where.push("(e.ends_at < ? OR e.lifecycle = 'cancelled')");
    params.push(nowMs());
  }
  if (query.q) {
    where.push("e.search_text LIKE ?");
    params.push(`%${query.q.toLowerCase()}%`);
  }
  if (query.category) {
    where.push("e.category = ?");
    params.push(query.category);
  }
  if (query.city) {
    where.push("e.city LIKE ?");
    params.push(`%${query.city}%`);
  }
  if (query.format) {
    where.push("e.format = ?");
    params.push(query.format);
  }
  const whereSql = where.join(" AND ");
  const order = `${sortColumn(query.sort)} ${query.dir === "asc" ? "ASC" : "DESC"}`;

  const total = await db
    .prepare(`SELECT COUNT(*) AS count FROM events e WHERE ${whereSql}`)
    .bind(...params)
    .first<{ count: number }>();
  const offset = (query.page - 1) * PAGE_SIZE;
  const { results } = await db
    .prepare(
      `SELECT e.*, (SELECT COALESCE(MAX(r.submitted_at), 0) FROM event_revisions r WHERE r.event_id = e.id) AS submitted_at, (SELECT COUNT(*) FROM event_registrations g WHERE g.event_id = e.id AND g.state = 'waitlisted') AS waitlist_count FROM events e WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`,
    )
    .bind(...params, PAGE_SIZE, offset)
    .all<EventRow & { submitted_at: number; waitlist_count: number }>();
  return {
    items: results.map((r) => adminRow(r, r.waitlist_count, r.submitted_at || null)),
    total: total?.count ?? 0,
    page: query.page,
    pageSize: PAGE_SIZE,
  };
}

export async function adminCounts(db: Db) {
  const [needsReview, changes, published, suspended, openReports] = await Promise.all([
    db
      .prepare("SELECT COUNT(*) AS count FROM events WHERE review_state = 'submitted'")
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM events WHERE review_state = 'changes_requested'")
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM events WHERE publication = 'published'")
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM events WHERE publication = 'suspended'")
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM event_reports WHERE status = 'open'")
      .first<{ count: number }>(),
  ]);
  return {
    needsReview: needsReview?.count ?? 0,
    changesRequested: changes?.count ?? 0,
    published: published?.count ?? 0,
    suspended: suspended?.count ?? 0,
    openReports: openReports?.count ?? 0,
  };
}

export async function adminEventDetail(db: Db, eventId: string): Promise<AdminEventDetail | null> {
  const row = await db
    .prepare(
      "SELECT e.*, (SELECT COALESCE(MAX(r.submitted_at), 0) FROM event_revisions r WHERE r.event_id = e.id) AS submitted_at, (SELECT COUNT(*) FROM event_registrations g WHERE g.event_id = e.id AND g.state = 'waitlisted') AS waitlist_count FROM events e WHERE e.id = ?",
    )
    .bind(eventId)
    .first<EventRow & { submitted_at: number; waitlist_count: number }>();
  if (!row) return null;
  const revision = await latestRevision(db, row.id);
  const approved = row.approved_revision_id
    ? await db
        .prepare("SELECT * FROM event_revisions WHERE id = ?")
        .bind(row.approved_revision_id)
        .first<RevisionRow>()
    : null;
  const reviews = await db
    .prepare(
      "SELECT r.*, rv.revision_no, u.email AS reviewer_email FROM event_reviews r LEFT JOIN event_revisions rv ON rv.id = r.revision_id LEFT JOIN user_emails u ON u.user_id = r.reviewer_user_id WHERE r.event_id = ? ORDER BY r.created_at DESC LIMIT 30",
    )
    .bind(row.id)
    .all<{
      id: string;
      decision: string;
      revision_no: number | null;
      organizer_message: string;
      internal_note: string;
      reviewer_email: string | null;
      created_at: number;
    }>();
  const organizers = await db
    .prepare("SELECT * FROM organizers WHERE id = ?")
    .bind(row.organizer_id)
    .all<{ id: string; name: string; slug: string; contact_email: string; status: string }>();
  const source = revision ?? approved;
  return {
    ...adminRow(row, row.waitlist_count, row.submitted_at || null),
    title: source?.title ?? row.title,
    summary: source?.summary ?? row.summary,
    category: source?.category ?? row.category,
    format: source?.format ?? row.format,
    city: source?.city ?? row.city,
    timezone: source?.timezone ?? row.timezone,
    startsAt: toIso(source?.starts_at ?? row.starts_at),
    endsAt: toIso(source?.ends_at ?? row.ends_at),
    description: source?.description ?? row.description,
    venue: source?.venue ?? row.venue,
    country: source?.country ?? row.country,
    onlineUrlPrivate: source?.online_url ?? null,
    accessibility: source?.accessibility ?? "",
    ageLimit: source?.age_limit ?? null,
    registrationOpensAt: source?.registration_opens_at ? toIso(source.registration_opens_at) : null,
    registrationClosesAt: source?.registration_closes_at
      ? toIso(source.registration_closes_at)
      : null,
    registrationClosed: row.registration_closed === 1,
    capacity: source ? source.capacity : row.capacity,
    waitlistEnabled: (source?.waitlist_enabled ?? row.waitlist_enabled) === 1,
    coverUrl: source?.cover_object_key
      ? `/api/events/id/${row.id}/cover?revision=${source.id}&v=${source.updated_at}`
      : coverUrlFor(row),
    revisionId: revision?.id ?? null,
    revisionNo: revision?.revision_no ?? row.approved_revision_no,
    approvedRevisionNo: row.approved_revision_no,
    organizers: (organizers.results ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      contactEmail: o.contact_email,
      status: o.status,
    })),
    reviews: reviews.results.map((r) => ({
      id: r.id,
      decision: r.decision,
      revisionNo: r.revision_no ?? 0,
      organizerMessage: r.organizer_message,
      internalNote: r.internal_note,
      reviewerName: r.reviewer_email ?? "Staff",
      createdAt: toIso(r.created_at),
    })),
  };
}

export async function decideReview(
  db: Db,
  params: {
    actor: StaffActor;
    eventId: string;
    revisionId: string;
    decision: "approved" | "changes_requested" | "rejected";
    organizerMessage: string;
    internalNote: string;
  },
) {
  const event = await db
    .prepare("SELECT * FROM events WHERE id = ?")
    .bind(params.eventId)
    .first<EventRow>();
  if (!event) throw err("NOT_FOUND", "Event not found.");
  const revision = await db
    .prepare("SELECT * FROM event_revisions WHERE id = ? AND event_id = ?")
    .bind(params.revisionId, params.eventId)
    .first<RevisionRow>();
  if (!revision) throw err("NOT_FOUND", "That revision no longer exists.");
  if (revision.review_state !== "submitted")
    throw err("REVISION_CONFLICT", "This revision is no longer awaiting review. Reload the event.");
  if (event.current_revision_id !== revision.id)
    throw err("REVISION_CONFLICT", "A newer revision was submitted. Reload before deciding.");
  if (revision.ends_at < nowMs() && params.decision === "approved")
    throw err("INVALID_INPUT", "This event's date has passed. Ask the organiser to update it.");

  const organizer = await db
    .prepare("SELECT * FROM organizers WHERE id = ?")
    .bind(event.organizer_id)
    .first<{ contact_email: string; name: string; status: string }>();
  if (params.decision === "approved" && organizer?.status !== "active")
    throw err("FORBIDDEN", "Restore the organiser before publishing this event.");
  const now = nowMs();
  const statements = [
    db
      .prepare(
        "INSERT INTO event_reviews (id, event_id, revision_id, reviewer_user_id, decision, organizer_message, internal_note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        newId("rvw"),
        event.id,
        revision.id,
        params.actor.userId,
        params.decision,
        params.organizerMessage,
        params.internalNote,
        now,
      ),
    db
      .prepare(
        "UPDATE event_revisions SET review_state = ?, decided_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(params.decision, now, now, revision.id),
  ];

  if (params.decision === "approved") {
    statements.push(
      db
        .prepare(
          "UPDATE events SET publication = 'published', review_state = 'approved', lifecycle = 'scheduled', approved_revision_id = ?, current_revision_id = ?, approved_revision_no = ?, title = ?, summary = ?, description = ?, category = ?, format = ?, city = ?, country = ?, venue = ?, timezone = ?, starts_at = ?, ends_at = ?, registration_opens_at = ?, registration_closes_at = ?, capacity = ?, waitlist_enabled = ?, cover_object_key = COALESCE(?, cover_object_key), cover_mime = COALESCE(?, cover_mime), search_text = ?, featured_until = NULL, version = version + 1, updated_at = ? WHERE id = ? AND current_revision_id = ?",
        )
        .bind(
          revision.id,
          revision.id,
          revision.revision_no,
          revision.title,
          revision.summary,
          revision.description,
          revision.category,
          revision.format,
          revision.city,
          revision.country,
          revision.venue,
          revision.timezone,
          revision.starts_at,
          revision.ends_at,
          revision.registration_opens_at,
          revision.registration_closes_at,
          revision.capacity,
          revision.waitlist_enabled,
          revision.cover_object_key,
          revision.cover_mime,
          buildSearchText([
            revision.title,
            revision.summary,
            revision.city,
            revision.country,
            organizer?.name ?? event.organizer_name,
          ]),
          now,
          event.id,
          revision.id,
        ),
    );
  } else {
    statements.push(
      db
        .prepare(
          "UPDATE events SET review_state = ?, current_revision_id = ?, version = version + 1, updated_at = ? WHERE id = ? AND current_revision_id = ?",
        )
        .bind(params.decision, revision.id, now, event.id, revision.id),
    );
  }

  if (organizer) {
    statements.push(
      outboxStatement(db, {
        deliveryKey: `review:${revision.id}`,
        kind:
          params.decision === "approved"
            ? "published"
            : params.decision === "rejected"
              ? "rejected"
              : "changes_requested",
        eventId: event.id,
        recipientEmail: organizer.contact_email,
        payload: {
          eventTitle: revision.title,
          message: params.organizerMessage,
          when: toIso(revision.starts_at),
        },
      }),
    );
  }

  try {
    await db.batch(statements);
  } catch (e) {
    // trg_event_review_current_revision aborts the whole batch when the pointer
    // moved, so nothing is recorded against a revision that is no longer current.
    mapDatabaseError(e);
  }
  await audit(db, params.actor.userId, `event.review.${params.decision}`, "event", event.id, {
    revisionNo: revision.revision_no,
  });
  return adminEventDetail(db, event.id);
}

export async function setPublication(
  db: Db,
  params: {
    actor: StaffActor;
    eventId: string;
    action: "suspend" | "republish" | "archive" | "cancel" | "postpone";
    reason: string;
  },
) {
  const event = await db
    .prepare("SELECT * FROM events WHERE id = ?")
    .bind(params.eventId)
    .first<EventRow>();
  if (!event) throw err("NOT_FOUND", "Event not found.");
  const now = nowMs();
  const notifyKind =
    params.action === "cancel"
      ? ("event_cancelled" as const)
      : params.action === "postpone"
        ? ("event_postponed" as const)
        : null;

  const next: {
    publication: EventRow["publication"];
    lifecycle: EventRow["lifecycle"];
    closed: number;
  } = {
    publication: event.publication,
    lifecycle: event.lifecycle,
    closed: event.registration_closed,
  };
  if (params.action === "suspend") {
    next.publication = "suspended";
    next.closed = 1;
  } else if (params.action === "republish") {
    if (event.review_state !== "approved")
      throw err("INVALID_INPUT", "Approve a revision before publishing.");
    next.publication = "published";
    if (event.lifecycle === "scheduled") next.closed = 0;
  } else if (params.action === "archive") {
    next.publication = "archived";
    next.closed = 1;
  } else if (params.action === "cancel") {
    next.lifecycle = "cancelled";
    next.closed = 1;
  } else if (params.action === "postpone") {
    next.lifecycle = "postponed";
    next.closed = 1;
  }

  const statements = [
    db
      .prepare(
        "UPDATE events SET publication = ?, lifecycle = ?, registration_closed = ?, version = version + 1, updated_at = ? WHERE id = ?",
      )
      .bind(next.publication, next.lifecycle, next.closed, now, event.id),
  ];
  if (notifyKind) {
    const regs = await db
      .prepare(
        "SELECT id, email FROM event_registrations WHERE event_id = ? AND state IN ('confirmed','waitlisted')",
      )
      .bind(event.id)
      .all<{ id: string; email: string }>();
    for (const r of regs.results) {
      statements.push(
        outboxStatement(db, {
          deliveryKey: `${notifyKind}:${event.id}:${r.id}:${now}`,
          kind: notifyKind,
          eventId: event.id,
          registrationId: r.id,
          recipientEmail: r.email,
          payload: { eventTitle: event.title, message: params.reason },
        }),
      );
    }
  }
  await db.batch(statements);
  await audit(db, params.actor.userId, `event.${params.action}`, "event", event.id, {
    reason: params.reason,
  });
  return adminEventDetail(db, event.id);
}

export async function setFeatured(
  db: Db,
  params: { actor: StaffActor; eventId: string; featured: boolean },
) {
  const event = await db
    .prepare("SELECT * FROM events WHERE id = ?")
    .bind(params.eventId)
    .first<EventRow>();
  if (!event) throw err("NOT_FOUND", "Event not found.");
  if (params.featured && event.publication !== "published")
    throw err("INVALID_INPUT", "Only a published event can be featured.");
  const now = nowMs();
  await db
    .prepare(
      "UPDATE events SET featured_until = ?, version = version + 1, updated_at = ? WHERE id = ?",
    )
    .bind(params.featured ? now + 30 * 86_400_000 : null, now, event.id)
    .run();
  await audit(
    db,
    params.actor.userId,
    params.featured ? "event.feature" : "event.unfeature",
    "event",
    event.id,
    {},
  );
  return { ok: true };
}

// ---- Reports ----

export async function createReport(
  db: Db,
  params: { eventSlug: string; reason: ReportReason; detail: string; reporterEmail: string },
) {
  const event = await db
    .prepare("SELECT id FROM events WHERE slug = ? AND publication = 'published'")
    .bind(params.eventSlug)
    .first<{ id: string }>();
  if (!event) throw err("NOT_FOUND", "Event not found.");
  await db
    .prepare(
      "INSERT INTO event_reports (id, event_id, reporter_email, reason, detail, status, resolution_note, resolved_by, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, 'open', '', NULL, ?, NULL)",
    )
    .bind(
      newId("rpt"),
      event.id,
      params.reporterEmail || null,
      params.reason,
      params.detail,
      nowMs(),
    )
    .run();
  return { ok: true };
}

export async function listReports(db: Db) {
  const { results } = await db
    .prepare(
      "SELECT r.*, e.title AS event_title, e.slug AS event_slug FROM event_reports r JOIN events e ON e.id = r.event_id ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 200",
    )
    .all<{
      id: string;
      event_id: string;
      event_title: string;
      event_slug: string;
      reason: ReportReason;
      detail: string;
      status: string;
      resolution_note: string;
      created_at: number;
    }>();
  return results.map((r) => ({
    id: r.id,
    eventId: r.event_id,
    eventTitle: r.event_title,
    eventSlug: r.event_slug,
    reason: r.reason,
    detail: r.detail,
    status: r.status,
    resolutionNote: r.resolution_note,
    createdAt: toIso(r.created_at),
  }));
}

export async function resolveReport(
  db: Db,
  params: {
    actor: StaffActor;
    reportId: string;
    resolution: "resolved" | "dismissed";
    note: string;
  },
) {
  const report = await db
    .prepare("SELECT * FROM event_reports WHERE id = ?")
    .bind(params.reportId)
    .first<{ id: string; status: string }>();
  if (!report) throw err("NOT_FOUND", "Report not found.");
  if (report.status !== "open") throw err("INVALID_INPUT", "This report is already closed.");
  await db
    .prepare(
      "UPDATE event_reports SET status = ?, resolution_note = ?, resolved_by = ?, resolved_at = ? WHERE id = ?",
    )
    .bind(params.resolution, params.note, params.actor.userId, nowMs(), params.reportId)
    .run();
  await audit(
    db,
    params.actor.userId,
    `report.${params.resolution}`,
    "event_report",
    params.reportId,
    {},
  );
  return { ok: true };
}

// ---- Organizer moderation ----

export async function listAdminOrganizers(db: Db) {
  const { results } = await db
    .prepare(
      "SELECT o.*, (SELECT COUNT(*) FROM events e WHERE e.organizer_id = o.id) AS event_count, (SELECT COUNT(*) FROM events e WHERE e.organizer_id = o.id AND e.publication = 'published') AS published_count, i.email AS owner_email FROM organizers o LEFT JOIN user_emails i ON i.user_id = o.owner_user_id ORDER BY o.created_at DESC LIMIT 200",
    )
    .all<{
      id: string;
      slug: string;
      name: string;
      bio: string;
      contact_email: string;
      city: string | null;
      country: string | null;
      status: string;
      created_at: number;
      event_count: number;
      published_count: number;
      owner_email: string | null;
    }>();
  return results.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    bio: r.bio,
    contactEmail: r.contact_email,
    ownerEmail: r.owner_email,
    city: r.city,
    country: r.country,
    status: r.status,
    eventCount: r.event_count,
    publishedCount: r.published_count,
    createdAt: toIso(r.created_at),
  }));
}

export async function setOrganizerStatus(
  db: Db,
  params: { actor: StaffActor; organizerId: string; status: "active" | "suspended" },
) {
  const organizer = await db
    .prepare("SELECT * FROM organizers WHERE id = ?")
    .bind(params.organizerId)
    .first<{ id: string }>();
  if (!organizer) throw err("NOT_FOUND", "Organiser not found.");
  const statements = [
    db
      .prepare(
        "UPDATE organizers SET status = ?, version = version + 1, updated_at = ? WHERE id = ?",
      )
      .bind(params.status, nowMs(), params.organizerId),
  ];
  if (params.status === "suspended") {
    statements.push(
      db
        .prepare(
          "UPDATE events SET publication = 'suspended', registration_closed = 1, version = version + 1, updated_at = ? WHERE organizer_id = ? AND publication = 'published'",
        )
        .bind(nowMs(), params.organizerId),
    );
  }
  await db.batch(statements);
  await audit(
    db,
    params.actor.userId,
    `organizer.${params.status}`,
    "organizer",
    params.organizerId,
    {},
  );
  return { ok: true };
}
