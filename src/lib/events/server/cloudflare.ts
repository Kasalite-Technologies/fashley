import type { Db } from "@/lib/tailor/server/db";
import type { VerifiedActor } from "@/lib/tailor/server/identity";
import {
  adaptD1,
  createClerkVerifier,
  isD1Like,
  isR2Like,
  secretResolver,
  type TailorWorkerEnv,
} from "@/lib/tailor/server/cloudflare";
import { createR2MediaStore } from "@/lib/tailor/server/media";
import { err } from "@/lib/tailor/server/errors";
import type { EventsHttpDeps } from "./http";
import type { EmailSender } from "./notifications";

/**
 * Cloudflare wiring for events. Shares the D1/R2/Clerk adapters the studio
 * already uses rather than creating a second database or identity path.
 */

export interface EventsWorkerEnv extends TailorWorkerEnv {
  /** Optional transactional sender. Without it, notifications stay queued. */
  RESEND_API_KEY?: unknown;
  EVENTS_EMAIL_FROM?: unknown;
}

export function createResendSender(
  resolveKey: () => Promise<string | null>,
  from: string,
): EmailSender {
  return {
    async send(message) {
      const key = await resolveKey();
      if (!key) throw err("FEATURE_UNAVAILABLE", "Email delivery is not configured.");
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "Idempotency-Key": message.deliveryKey.slice(0, 200),
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw err(
          "PROVIDER_UNAVAILABLE",
          `Email provider rejected the message (${response.status}) ${detail.slice(0, 120)}`.trim(),
        );
      }
      const payload = (await response.json().catch(() => null)) as { id?: string } | null;
      return { providerMessageId: payload?.id ?? null };
    },
  };
}

export function eventsDepsFromEnv(env: EventsWorkerEnv): EventsHttpDeps {
  const deps: EventsHttpDeps = {};
  if (isD1Like(env.DB)) deps.db = adaptD1(env.DB);
  if (env.CLERK_SECRET_KEY) {
    deps.verifier = createClerkVerifier(secretResolver(env.CLERK_SECRET_KEY)) as (
      request: Request,
    ) => Promise<VerifiedActor | null>;
  }
  if (isR2Like(env.TAILOR_MEDIA)) {
    deps.media = createR2MediaStore(env.TAILOR_MEDIA);
  }
  if (env.RESEND_API_KEY) {
    const from =
      typeof env.EVENTS_EMAIL_FROM === "string" && env.EVENTS_EMAIL_FROM
        ? env.EVENTS_EMAIL_FROM
        : "Fashley Events <events@fashley.app>";
    deps.email = createResendSender(secretResolver(env.RESEND_API_KEY as never), from);
  }
  return deps;
}

export type { Db };
