import type { Db } from "@/lib/tailor/server/db";
import { TailorError, err, errorEnvelope, newRequestId } from "@/lib/tailor/server/errors";
import { ensureLocalUser, type VerifiedActor } from "@/lib/tailor/server/identity";
import { nowMs } from "@/lib/tailor/server/util";
import type { MediaStore } from "@/lib/tailor/server/config";
import type { EmailSender } from "./notifications";
import { dispatchOutbox } from "./notifications";
import { consumeReportAttempt } from "./report-rate-limit";
import {
  requirePlatformAdmin,
  requireStaff,
  listAudit,
  listStaff,
  grantStaffRole,
  revokeStaffRole,
  staffRole,
} from "./authorization";
import {
  cancelOwnedEvent,
  getEventForEditor,
  getMyOrganizer,
  getOrganizerProfile,
  getPublicEvent,
  listCities,
  listDirectory,
  listMyEvents,
  saveEventDraft,
  saveOrganizerProfile,
  setRegistrationClosed,
  submitEvent,
  withdrawEvent,
} from "./events";
import {
  cancelRegistration,
  checkInByCredential,
  getOwnRegistration,
  listEventAttendees,
  listMyRegistrations,
  promoteWaitlisted,
  registerForEvent,
  ticketCredential,
} from "./registrations";
import {
  adminCounts,
  adminEventDetail,
  createReport,
  decideReview,
  listAdminEvents,
  listAdminOrganizers,
  listReports,
  resolveReport,
  setFeatured,
  setOrganizerStatus,
  setPublication,
} from "./admin";
import {
  adminListQuerySchema,
  directoryQuerySchema,
  draftEventInputSchema,
  eventLifecycleActionSchema,
  organizerProfileInputSchema,
  registrationInputSchema,
  reportInputSchema,
  reviewDecisionSchema,
  checkInInputSchema,
} from "@/lib/events/contracts";
import {
  mapDatabaseError,
  requireOrganizerForUser,
  type EventRow,
  type OrganizerRow,
} from "./store";
import { newId } from "@/lib/tailor/server/errors";

export interface EventsHttpDeps {
  db?: Db;
  verifier?: (request: Request) => Promise<VerifiedActor | null>;
  media?: MediaStore;
  email?: EmailSender;
}

let registered: EventsHttpDeps | undefined;
export function setEventsHttpDeps(deps: EventsHttpDeps | undefined) {
  registered = deps;
  (globalThis as unknown as { __eventsHttpDeps?: EventsHttpDeps | undefined }).__eventsHttpDeps =
    deps;
}
export function resolveEventsHttpDeps(): EventsHttpDeps {
  if (registered) return registered;
  const g = globalThis as unknown as { __eventsHttpDeps?: EventsHttpDeps };
  return g.__eventsHttpDeps ?? {};
}

const MAX_COVER_BYTES = 6_000_000;
const COVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function json(status: number, body: unknown, extra?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
}

export function createEventsHandlers(deps: EventsHttpDeps = resolveEventsHttpDeps()) {
  async function wrap(
    fn: () => Promise<{ status: number; data: unknown; headers?: HeadersInit }>,
  ): Promise<Response> {
    const requestId = newRequestId();
    try {
      const r = await fn();
      return json(r.status, { data: r.data, requestId }, r.headers);
    } catch (e) {
      let mapped = e;
      try {
        mapDatabaseError(e);
      } catch (error) {
        mapped = error;
      }
      const { body, status } = errorEnvelope(mapped, requestId);
      return json(status, body);
    }
  }

  function requireDb(): Db {
    if (!deps.db) throw err("FEATURE_UNAVAILABLE", "Events database is not configured.");
    return deps.db;
  }

  async function rememberEmail(db: Db, userId: string, email: string) {
    await db
      .prepare(
        "INSERT INTO user_emails (user_id, email, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, updated_at = excluded.updated_at",
      )
      .bind(userId, email, nowMs())
      .run();
  }

  async function signedIn(request: Request) {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const origin = request.headers.get("origin");
      if (
        (origin && origin !== new URL(request.url).origin) ||
        (!origin && request.headers.has("cookie") && !request.headers.has("authorization"))
      )
        throw err("FORBIDDEN", "Cross-site event actions are not allowed.");
    }
    const db = requireDb();
    if (!deps.verifier) throw err("FEATURE_UNAVAILABLE", "Sign-in is not configured.");
    const actor = await deps.verifier(request);
    if (!actor) throw err("UNAUTHENTICATED", "Sign in to continue.");
    const { userId } = await ensureLocalUser(db, actor);
    if (actor.emailVerified === true) await rememberEmail(db, userId, actor.email);
    else await db.prepare("DELETE FROM user_emails WHERE user_id = ?").bind(userId).run();
    return { db, actor, userId };
  }

  async function verified(request: Request) {
    const ctx = await signedIn(request);
    if (ctx.actor.emailVerified !== true)
      throw err(
        "VERIFICATION_REQUIRED",
        "Verify your email address in your account settings before continuing.",
      );
    return ctx;
  }

  async function staff(request: Request) {
    const ctx = await verified(request);
    const actor = await requireStaff(ctx.db, ctx.userId);
    return { ...ctx, staff: actor };
  }

  async function platformAdmin(request: Request) {
    const ctx = await verified(request);
    const actor = await requirePlatformAdmin(ctx.db, ctx.userId);
    return { ...ctx, staff: actor };
  }

  async function organizerContext(request: Request) {
    const ctx = await verified(request);
    const organizer = await requireOrganizerForUser(ctx.db, ctx.userId);
    return { ...ctx, organizer };
  }

  async function parse<T>(
    request: Request,
    schema: {
      safeParse: (v: unknown) => {
        success: boolean;
        data?: T;
        error?: { flatten: () => { fieldErrors: Record<string, string[]> } };
      };
    },
  ): Promise<T> {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw err("INVALID_INPUT", "Malformed JSON body.");
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new TailorError(
        "INVALID_INPUT",
        "Check the highlighted fields.",
        undefined,
        parsed.error?.flatten().fieldErrors as Record<string, string[]>,
      );
    }
    return parsed.data as T;
  }

  function query<T>(
    request: Request,
    schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  ): T {
    const url = new URL(request.url);
    const raw: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      raw[key] = value;
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw err("INVALID_INPUT", "Those filters are not valid.");
    return parsed.data as T;
  }

  async function loadPublicEvent(db: Db, slug: string) {
    const event = await db
      .prepare("SELECT * FROM events WHERE slug = ? AND publication = 'published'")
      .bind(slug)
      .first<EventRow>();
    if (!event) throw err("NOT_FOUND", "Event not found.");
    return event;
  }

  return {
    // ---- Public ----

    directory: (request: Request) =>
      wrap(async () => {
        const db = requireDb();
        const q = query(request, directoryQuerySchema);
        return { status: 200, data: await listDirectory(db, q) };
      }),

    cities: () =>
      wrap(async () => ({ status: 200, data: { items: await listCities(requireDb()) } })),

    event: (request: Request, slug: string) =>
      wrap(async () => {
        const detail = await getPublicEvent(requireDb(), slug);
        if (!detail) throw err("NOT_FOUND", "Event not found.");
        return { status: 200, data: detail };
      }),

    organizer: (request: Request, slug: string) =>
      wrap(async () => {
        const profile = await getOrganizerProfile(requireDb(), slug);
        if (!profile) throw err("NOT_FOUND", "Organiser not found.");
        return { status: 200, data: profile };
      }),

    report: (request: Request, slug: string) =>
      wrap(async () => {
        const db = requireDb();
        await consumeReportAttempt(db, request);
        const input = await parse(request, reportInputSchema);
        return {
          status: 201,
          data: await createReport(db, { eventSlug: slug, ...input }),
        };
      }),

    cover: async (request: Request, eventId: string): Promise<Response> => {
      const requestId = newRequestId();
      try {
        const db = requireDb();
        if (!deps.media) throw err("FEATURE_UNAVAILABLE", "Media storage is not configured.");
        const event = await db
          .prepare("SELECT * FROM events WHERE id = ?")
          .bind(eventId)
          .first<EventRow>();
        if (!event) throw err("NOT_FOUND", "Cover not found.");
        const revisionId = new URL(request.url).searchParams.get("revision");
        let key = event.cover_object_key;
        let mime = event.cover_mime;
        let allowed = event.publication === "published" && !revisionId;
        if (!allowed) {
          try {
            const ctx = await signedIn(request);
            const owns = await db
              .prepare("SELECT id FROM organizers WHERE id = ? AND owner_user_id = ?")
              .bind(event.organizer_id, ctx.userId)
              .first<{ id: string }>();
            allowed = Boolean(owns) || Boolean(await staffRole(db, ctx.userId));
          } catch {
            allowed = false;
          }
        }
        if (!allowed) throw err("NOT_FOUND", "Cover not found.");
        if (revisionId) {
          const revision = await db
            .prepare(
              "SELECT cover_object_key, cover_mime FROM event_revisions WHERE id = ? AND event_id = ?",
            )
            .bind(revisionId, event.id)
            .first<{ cover_object_key: string | null; cover_mime: string | null }>();
          key = revision?.cover_object_key ?? null;
          mime = revision?.cover_mime ?? null;
        }
        if (!key) throw err("NOT_FOUND", "Cover not found.");
        const bytes = await deps.media.getPrivate(key);
        return new Response(bytes as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": mime ?? "image/jpeg",
            "Content-Length": String(bytes.byteLength),
            "Cache-Control":
              event.publication === "published" && !revisionId
                ? "public, max-age=300"
                : "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (e) {
        const { body, status } = errorEnvelope(e, requestId);
        return json(status, body);
      }
    },

    // ---- Attendee ----

    register: (request: Request, slug: string) =>
      wrap(async () => {
        const { db, userId, actor } = await verified(request);
        const event = await loadPublicEvent(db, slug);
        const input = await parse(request, registrationInputSchema);
        if (input.email.toLowerCase() !== actor.email.toLowerCase())
          throw err("INVALID_INPUT", "Use the verified email address on your Fashley account.");
        const result = await registerForEvent(db, { userId, event, input, wantsWaitlist: false });
        return { status: 201, data: result };
      }),

    joinWaitlist: (request: Request, slug: string) =>
      wrap(async () => {
        const { db, userId, actor } = await verified(request);
        const event = await loadPublicEvent(db, slug);
        const input = await parse(request, registrationInputSchema);
        if (input.email.toLowerCase() !== actor.email.toLowerCase())
          throw err("INVALID_INPUT", "Use the verified email address on your Fashley account.");
        const result = await registerForEvent(db, {
          userId,
          event,
          input,
          wantsWaitlist: true,
        });
        return { status: 201, data: result };
      }),

    myRegistrations: (request: Request) =>
      wrap(async () => {
        const { db, userId } = await signedIn(request);
        return { status: 200, data: { items: await listMyRegistrations(db, userId) } };
      }),

    myRegistration: (request: Request, registrationId: string) =>
      wrap(async () => {
        const { db, userId } = await signedIn(request);
        return { status: 200, data: await getOwnRegistration(db, userId, registrationId) };
      }),

    ticket: (request: Request, registrationId: string) =>
      wrap(async () => {
        const { db, userId } = await signedIn(request);
        return { status: 200, data: await ticketCredential(db, userId, registrationId) };
      }),

    cancelMyRegistration: (request: Request, registrationId: string) =>
      wrap(async () => {
        const { db, userId } = await signedIn(request);
        return { status: 200, data: await cancelRegistration(db, { userId, registrationId }) };
      }),

    // ---- Organizer ----

    myOrganizer: (request: Request) =>
      wrap(async () => {
        const { db, userId } = await signedIn(request);
        return { status: 200, data: await getMyOrganizer(db, userId) };
      }),

    saveOrganizer: (request: Request) =>
      wrap(async () => {
        const { db, userId } = await verified(request);
        const input = await parse(request, organizerProfileInputSchema);
        return { status: 200, data: await saveOrganizerProfile(db, userId, input) };
      }),

    myEvents: (request: Request) =>
      wrap(async () => {
        const { db, userId } = await signedIn(request);
        const organizer = await getMyOrganizer(db, userId);
        if (!organizer) return { status: 200, data: { items: [], organizer: null } };
        return {
          status: 200,
          data: { items: await listMyEvents(db, organizer.id), organizer },
        };
      }),

    createEvent: (request: Request) =>
      wrap(async () => {
        const { db, userId, organizer } = await organizerContext(request);
        const input = await parse(request, draftEventInputSchema);
        const data = await saveEventDraft(db, { userId, organizer, input });
        return { status: 201, data };
      }),

    saveEvent: (request: Request, eventId: string) =>
      wrap(async () => {
        const { db, userId, organizer } = await organizerContext(request);
        const input = await parse(request, draftEventInputSchema);
        const data = await saveEventDraft(db, { userId, organizer, eventId, input });
        return { status: 200, data };
      }),

    myEvent: (request: Request, eventId: string) =>
      wrap(async () => {
        const { db, userId, organizer } = await organizerContext(request);
        return {
          status: 200,
          data: await getEventForEditor(db, organizer.id, eventId, userId),
        };
      }),

    submitMyEvent: (request: Request, eventId: string) =>
      wrap(async () => {
        const { db, userId, organizer } = await organizerContext(request);
        await parse(request, {
          safeParse: (v: unknown) => ({ success: typeof v === "object" && v !== null, data: v }),
        });
        return { status: 200, data: await submitEvent(db, { userId, organizer, eventId }) };
      }),

    withdrawMyEvent: (request: Request, eventId: string) =>
      wrap(async () => {
        const { db, userId, organizer } = await organizerContext(request);
        return { status: 200, data: await withdrawEvent(db, { userId, organizer, eventId }) };
      }),

    closeMyRegistration: (request: Request, eventId: string) =>
      wrap(async () => {
        const { db, userId, organizer } = await organizerContext(request);
        const input = await parse(request, eventLifecycleActionSchema);
        if (input.action === "cancel") {
          return {
            status: 200,
            data: await cancelOwnedEvent(db, {
              userId,
              organizer,
              eventId,
              reason: input.reason,
            }),
          };
        }
        if (input.action !== "close_registration" && input.action !== "reopen_registration")
          throw err("INVALID_INPUT", "That action is not an organiser registration control.");
        const closed = input.action !== "reopen_registration";
        return {
          status: 200,
          data: await setRegistrationClosed(db, {
            userId,
            organizer,
            eventId,
            closed,
          }),
        };
      }),

    myAttendees: (request: Request, eventId: string) =>
      wrap(async () => {
        const { db, organizer } = await organizerContext(request);
        await assertOwnedEvent(db, organizer, eventId);
        return { status: 200, data: { items: await listEventAttendees(db, eventId) } };
      }),

    promote: (request: Request, eventId: string, registrationId: string) =>
      wrap(async () => {
        const { db, userId, organizer } = await organizerContext(request);
        const event = await assertOwnedEvent(db, organizer, eventId);
        return {
          status: 200,
          data: await promoteWaitlisted(db, { userId, event, registrationId }),
        };
      }),

    checkIn: (request: Request, eventId: string) =>
      wrap(async () => {
        const { db, userId, organizer } = await organizerContext(request);
        const event = await assertOwnedEvent(db, organizer, eventId);
        const input = await parse(request, checkInInputSchema);
        return {
          status: 200,
          data: await checkInByCredential(db, { userId, event, credential: input.credential }),
        };
      }),

    uploadCover: (request: Request, eventId: string) =>
      wrap(async () => {
        const { db, organizer } = await organizerContext(request);
        if (!deps.media) throw err("FEATURE_UNAVAILABLE", "Media storage is not configured.");
        const event = await assertOwnedEvent(db, organizer, eventId);
        const contentType = (request.headers.get("content-type") ?? "").split(";")[0]!.trim();
        if (!COVER_TYPES.has(contentType))
          throw err("UPLOAD_REJECTED", "Use a JPEG, PNG or WebP image.");
        const bytes = await readCover(request);
        if (!bytes.length) throw err("UPLOAD_REJECTED", "The image was empty.");
        if (bytes.length > MAX_COVER_BYTES)
          throw err("UPLOAD_REJECTED", "The image must be smaller than 6 MB.");
        const ext =
          contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
        // The cover belongs to the revision under review. A published listing
        // keeps serving its approved cover until an editor approves the change,
        // so replacing the file here can never alter the live event.
        const current = await db
          .prepare("SELECT id, review_state FROM event_revisions WHERE id = ? AND event_id = ?")
          .bind(event.current_revision_id, event.id)
          .first<{ id: string; review_state: string }>();
        if (!current || !["draft", "changes_requested"].includes(current.review_state))
          throw err("INVALID_INPUT", "Save a working draft before changing the cover.");
        const key = `events/${event.id}/cover-${newId("img")}.${ext}`;
        await deps.media.putPrivate(key, bytes);
        const now = nowMs();
        try {
          await db.batch([
            db
              .prepare(
                "UPDATE event_revisions SET cover_object_key = ?, cover_mime = ?, updated_at = ? WHERE id = ?",
              )
              .bind(key, contentType, now, current.id),
            db
              .prepare("UPDATE events SET version = ?, updated_at = ? WHERE id = ?")
              .bind(event.version + 1, now, event.id),
          ]);
        } catch (e) {
          await deps.media.deletePrivate(key).catch(() => undefined);
          throw e;
        }
        return {
          status: 200,
          data: { coverUrl: `/api/events/id/${event.id}/cover?revision=${current.id}&v=${now}` },
        };
      }),

    // ---- Admin ----

    adminSession: (request: Request) =>
      wrap(async () => {
        const { db, userId } = await signedIn(request);
        const role = await staffRole(db, userId);
        return { status: 200, data: { userId, role, canManageStaff: role === "platform_admin" } };
      }),

    adminEvents: (request: Request) =>
      wrap(async () => {
        const { db } = await staff(request);
        const q = query(request, adminListQuerySchema);
        return { status: 200, data: await listAdminEvents(db, q) };
      }),

    adminCounts: (request: Request) =>
      wrap(async () => {
        const { db } = await staff(request);
        return { status: 200, data: await adminCounts(db) };
      }),

    adminEvent: (request: Request, eventId: string) =>
      wrap(async () => {
        const { db } = await staff(request);
        const detail = await adminEventDetail(db, eventId);
        if (!detail) throw err("NOT_FOUND", "Event not found.");
        return { status: 200, data: detail };
      }),

    adminReview: (request: Request, eventId: string) =>
      wrap(async () => {
        const { db, staff: actor } = await staff(request);
        const input = await parse(request, reviewDecisionSchema);
        return {
          status: 200,
          data: await decideReview(db, {
            actor,
            eventId,
            revisionId: input.revisionId,
            decision: input.decision,
            organizerMessage: input.organizerMessage,
            internalNote: input.internalNote,
          }),
        };
      }),

    adminPublication: (request: Request, eventId: string) =>
      wrap(async () => {
        const { db, staff: actor } = await staff(request);
        const input = await parse(request, eventLifecycleActionSchema);
        if (input.action === "close_registration" || input.action === "reopen_registration")
          throw err("INVALID_INPUT", "Registration controls belong to the organiser.");
        return {
          status: 200,
          data: await setPublication(db, {
            actor,
            eventId,
            action: input.action,
            reason: input.reason,
          }),
        };
      }),

    adminFeature: (request: Request, eventId: string) =>
      wrap(async () => {
        const { db, staff: actor } = await staff(request);
        const body = await parse(request, {
          safeParse: (v: unknown) => ({
            success: typeof v === "object" && v !== null,
            data: v as { featured?: boolean },
          }),
        });
        return {
          status: 200,
          data: await setFeatured(db, { actor, eventId, featured: Boolean(body.featured) }),
        };
      }),

    adminOrganizers: (request: Request) =>
      wrap(async () => {
        const { db } = await staff(request);
        return { status: 200, data: { items: await listAdminOrganizers(db) } };
      }),

    adminOrganizerStatus: (request: Request, organizerId: string) =>
      wrap(async () => {
        const { db, staff: actor } = await staff(request);
        const body = await parse(request, {
          safeParse: (v: unknown) => ({
            success:
              typeof v === "object" &&
              v !== null &&
              ["active", "suspended"].includes(String((v as { status?: unknown }).status)),
            data: v as { status: "active" | "suspended" },
          }),
        });
        return {
          status: 200,
          data: await setOrganizerStatus(db, { actor, organizerId, status: body.status }),
        };
      }),

    adminReports: (request: Request) =>
      wrap(async () => {
        const { db } = await staff(request);
        return { status: 200, data: { items: await listReports(db) } };
      }),

    adminResolveReport: (request: Request, reportId: string) =>
      wrap(async () => {
        const { db, staff: actor } = await staff(request);
        const body = await parse(request, {
          safeParse: (v: unknown) => {
            const rec = (v ?? {}) as { resolution?: unknown; note?: unknown };
            return {
              success: rec.resolution === "resolved" || rec.resolution === "dismissed",
              data: {
                resolution: rec.resolution as "resolved" | "dismissed",
                note: typeof rec.note === "string" ? rec.note.slice(0, 600) : "",
              },
            };
          },
        });
        return {
          status: 200,
          data: await resolveReport(db, { actor, reportId, ...body }),
        };
      }),

    adminActivity: (request: Request) =>
      wrap(async () => {
        const { db } = await staff(request);
        return { status: 200, data: { items: await listAudit(db) } };
      }),

    adminStaff: (request: Request) =>
      wrap(async () => {
        const { db } = await staff(request);
        return { status: 200, data: { items: await listStaff(db) } };
      }),

    adminGrantStaff: (request: Request) =>
      wrap(async () => {
        const { db, staff: actor } = await platformAdmin(request);
        const body = await parse(request, {
          safeParse: (v: unknown) => {
            const rec = (v ?? {}) as { email?: unknown; role?: unknown };
            return {
              success:
                typeof rec.email === "string" &&
                ["events_editor", "platform_admin"].includes(String(rec.role)),
              data: {
                email: String(rec.email ?? "")
                  .trim()
                  .toLowerCase(),
                role: rec.role as "events_editor" | "platform_admin",
              },
            };
          },
        });
        const targets = await db
          .prepare(
            "SELECT u.user_id FROM user_emails u JOIN app_users a ON a.id = u.user_id WHERE lower(u.email) = ? AND a.status = 'active' LIMIT 2",
          )
          .bind(body.email)
          .all<{ user_id: string }>();
        const target = targets.results.length === 1 ? targets.results[0] : null;
        if (!target)
          throw err(
            "NOT_FOUND",
            "A single active account with that verified email is required. Confirm the account before granting access.",
          );
        return {
          status: 201,
          data: await grantStaffRole(db, actor, { userId: target.user_id, role: body.role }),
        };
      }),

    adminRevokeStaff: (request: Request, grantId: string) =>
      wrap(async () => {
        const { db, staff: actor } = await platformAdmin(request);
        return { status: 200, data: await revokeStaffRole(db, actor, grantId) };
      }),

    dispatchNotifications: (request: Request) =>
      wrap(async () => {
        const { db } = await platformAdmin(request);
        return { status: 200, data: await dispatchOutbox(db, deps.email, 10) };
      }),
  };
}

async function assertOwnedEvent(
  db: Db,
  organizer: OrganizerRow,
  eventId: string,
): Promise<EventRow> {
  const row = await db
    .prepare("SELECT * FROM events WHERE id = ? AND organizer_id = ?")
    .bind(eventId, organizer.id)
    .first<EventRow>();
  if (!row) throw err("NOT_FOUND", "Event not found.");
  return row;
}

export type EventsHandlers = ReturnType<typeof createEventsHandlers>;
export const eventsHandlers = () => createEventsHandlers();

async function readCover(request: Request): Promise<Uint8Array> {
  const reader = request.body?.getReader();
  if (!reader) throw err("UPLOAD_REJECTED", "The image was empty.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_COVER_BYTES) {
        await reader.cancel();
        throw err("UPLOAD_REJECTED", "The image must be smaller than 6 MB.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
