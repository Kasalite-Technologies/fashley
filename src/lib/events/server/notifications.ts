import type { Db } from "@/lib/tailor/server/db";
import { newId } from "@/lib/tailor/server/errors";
import { nowMs } from "@/lib/tailor/server/util";

/**
 * Notifications are written to a durable outbox inside the same transaction as
 * the business change. Delivery is best effort and never reverses a
 * registration. Without a configured provider, rows stay pending and the admin
 * surface says so instead of pretending mail was sent.
 */

export type NotificationKind =
  | "submission_received"
  | "changes_requested"
  | "rejected"
  | "published"
  | "registration_confirmed"
  | "registration_waitlisted"
  | "promotion_confirmed"
  | "registration_cancelled"
  | "event_cancelled"
  | "event_postponed"
  | "event_changed"
  | "seat_available"
  | "registration_reminder";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  deliveryKey: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<{ providerMessageId: string | null }>;
}

export interface OutboxIntent {
  deliveryKey: string;
  kind: NotificationKind;
  eventId: string;
  registrationId?: string | null;
  recipientEmail: string;
  payload?: Record<string, unknown>;
}

/** Prepared INSERT so callers can include it in an atomic batch. */
export function outboxStatement(db: Db, intent: OutboxIntent) {
  const now = nowMs();
  return db
    .prepare(
      "INSERT INTO event_notification_outbox (id, delivery_key, kind, event_id, registration_id, recipient_email, payload_json, state, attempts, next_attempt_at, provider_message_id, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, NULL, NULL, ?, ?)",
    )
    .bind(
      newId("ntf"),
      intent.deliveryKey,
      intent.kind,
      intent.eventId,
      intent.registrationId ?? null,
      intent.recipientEmail,
      JSON.stringify(intent.payload ?? {}),
      now,
      now,
      now,
    );
}

/** Non-transactional single write, for audit-style notices. */
export async function queueNotification(db: Db, intent: OutboxIntent) {
  await outboxStatement(db, intent).run();
}

export async function listOutbox(db: Db, eventId: string, limit = 40) {
  const { results } = await db
    .prepare(
      "SELECT * FROM event_notification_outbox WHERE event_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .bind(eventId, Math.min(100, Math.max(1, limit)))
    .all<{
      id: string;
      kind: NotificationKind;
      recipient_email: string;
      state: string;
      attempts: number;
      last_error: string | null;
      created_at: number;
    }>();
  return results.map((r) => ({
    id: r.id,
    kind: r.kind,
    recipientEmail: r.recipient_email,
    state: r.state,
    attempts: r.attempts,
    lastError: r.last_error,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export function renderNotification(
  kind: NotificationKind,
  payload: Record<string, unknown>,
): { subject: string; text: string } {
  const title = typeof payload["eventTitle"] === "string" ? payload["eventTitle"] : "your event";
  const when = typeof payload["when"] === "string" ? `\n\n${payload["when"]}` : "";
  const note = typeof payload["message"] === "string" ? `\n\n${payload["message"]}` : "";
  switch (kind) {
    case "submission_received":
      return {
        subject: `We received ${title} for review`,
        text: `Thanks for submitting ${title}. Fashley reviews each listing before it appears in the directory. We will email you when there is a decision.${when}`,
      };
    case "changes_requested":
      return {
        subject: `Changes requested for ${title}`,
        text: `An editor reviewed ${title} and asked for changes before it can be published.${note}${when}\n\nOpen your organiser dashboard to update the listing.`,
      };
    case "rejected":
      return {
        subject: `${title} was not approved`,
        text: `An editor reviewed ${title} and did not approve it for the directory.${note}`,
      };
    case "published":
      return {
        subject: `${title} is now listed on Fashley`,
        text: `${title} is published in the Fashley events directory.${when}\n\nYou can manage registrations from your organiser dashboard.`,
      };
    case "registration_confirmed":
      return {
        subject: `You are registered for ${title}`,
        text: `Your place at ${title} is confirmed.${when}\n\nOpen My events on Fashley for your ticket code, calendar link and access details.`,
      };
    case "registration_waitlisted":
      return {
        subject: `You joined the waitlist for ${title}`,
        text: `You are on the waitlist for ${title}. The organiser confirms places manually, so this is not a confirmed seat. We will email you if a place opens.${when}`,
      };
    case "promotion_confirmed":
      return {
        subject: `A place opened for ${title}`,
        text: `The organiser confirmed your place at ${title}.${when}\n\nOpen My events on Fashley for your ticket code.`,
      };
    case "registration_cancelled":
      return {
        subject: `Your registration for ${title} was cancelled`,
        text: `Your registration for ${title} has been cancelled and your ticket is no longer valid.${when}`,
      };
    case "event_cancelled":
      return {
        subject: `${title} has been cancelled`,
        text: `The organiser cancelled ${title}.${note}${when}\n\nYour registration is no longer valid for entry.`,
      };
    case "event_postponed":
      return {
        subject: `${title} has been postponed`,
        text: `${title} has been postponed and registration is paused until a new date is published.${note}`,
      };
    case "event_changed":
      return {
        subject: `Details changed for ${title}`,
        text: `The organiser updated the schedule or venue for ${title}.${note}${when}\n\nCheck the event page before you travel.`,
      };
    case "seat_available":
      return {
        subject: `A place opened for ${title}`,
        text: `A confirmed place opened for ${title}. You can promote someone from the waitlist in your organiser dashboard.${when}`,
      };
    case "registration_reminder":
      return {
        subject: `Reminder: ${title}`,
        text: `${title} is coming up.${when}\n\nOpen My events on Fashley for your ticket code and access details.`,
      };
    default:
      return { subject: "Fashley events", text: `${title}${when}${note}` };
  }
}

/** Claims and attempts due notifications. Returns the number sent. */
export async function dispatchOutbox(
  db: Db,
  sender: EmailSender | undefined,
  limit = 20,
): Promise<{ sent: number; failed: number; skipped: number }> {
  if (!sender) return { sent: 0, failed: 0, skipped: 0 };
  const now = nowMs();
  const { results } = await db
    .prepare(
      "SELECT * FROM event_notification_outbox WHERE state = 'pending' AND next_attempt_at <= ? ORDER BY next_attempt_at LIMIT ?",
    )
    .bind(now, Math.min(50, Math.max(1, limit)))
    .all<{
      id: string;
      delivery_key: string;
      kind: NotificationKind;
      recipient_email: string;
      payload_json: string;
      attempts: number;
    }>();
  let sent = 0;
  let failed = 0;
  for (const row of results) {
    // Lease the row before contacting the provider. A second dispatcher cannot
    // send the same pending row while this attempt is in flight.
    const leaseUntil = nowMs() + 120_000;
    const claim = await db
      .prepare(
        "UPDATE event_notification_outbox SET next_attempt_at = ?, attempts = attempts + 1, updated_at = ? WHERE id = ? AND state = 'pending' AND next_attempt_at <= ? AND attempts = ?",
      )
      .bind(leaseUntil, nowMs(), row.id, now, row.attempts)
      .run();
    if (!claim.changes) continue;
    let payload: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(row.payload_json);
      if (typeof parsed === "object" && parsed !== null)
        payload = parsed as Record<string, unknown>;
    } catch {
      payload = {};
    }
    const rendered = renderNotification(row.kind, payload);
    try {
      const result = await sender.send({
        to: row.recipient_email,
        subject: rendered.subject,
        text: rendered.text,
        deliveryKey: row.delivery_key,
      });
      await db
        .prepare(
          "UPDATE event_notification_outbox SET state = 'sent', provider_message_id = ?, last_error = NULL, updated_at = ? WHERE id = ? AND state = 'pending' AND next_attempt_at = ?",
        )
        .bind(result.providerMessageId, nowMs(), row.id, leaseUntil)
        .run();
      sent += 1;
    } catch (e) {
      const attempts = row.attempts + 1;
      const terminal = attempts >= 5;
      await db
        .prepare(
          "UPDATE event_notification_outbox SET state = ?, attempts = ?, next_attempt_at = ?, last_error = ?, updated_at = ? WHERE id = ? AND state = 'pending' AND next_attempt_at = ?",
        )
        .bind(
          terminal ? "failed" : "pending",
          attempts,
          now + Math.min(60 * 60 * 1000, attempts * 5 * 60 * 1000),
          e instanceof Error ? e.message.slice(0, 200) : "Delivery failed.",
          now,
          row.id,
          leaseUntil,
        )
        .run();
      failed += 1;
    }
  }
  return { sent, failed, skipped: 0 };
}
