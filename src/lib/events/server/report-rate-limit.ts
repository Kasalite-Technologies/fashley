import type { Db } from "@/lib/tailor/server/db";
import { err } from "@/lib/tailor/server/errors";
import { nowMs, sha256Hex } from "@/lib/tailor/server/util";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function consumeReportAttempt(db: Db, request: Request) {
  // Cloudflare supplies this header at ingress. Never trust X-Forwarded-For
  // or a client-chosen email as a fallback caller identity.
  const ip = request.headers.get("CF-Connecting-IP")?.trim();
  if (!ip || ip.length > 64)
    throw err("FEATURE_UNAVAILABLE", "Report submission is temporarily unavailable.");

  const bucket = await sha256Hex(`event-report:${ip}`);
  const now = nowMs();
  const cutoff = now - WINDOW_MS;
  await db
    .prepare(
      "DELETE FROM event_report_rate_limits WHERE bucket_key_hash IN (SELECT bucket_key_hash FROM event_report_rate_limits WHERE window_start <= ? ORDER BY window_start LIMIT 100)",
    )
    .bind(cutoff)
    .run();

  // One conditional UPSERT, not a read-then-write: concurrent requests cannot
  // each consume the last slot. The bucket is shared across all event slugs.
  const result = await db
    .prepare(
      `INSERT INTO event_report_rate_limits (bucket_key_hash, window_start, attempt_count)
       VALUES (?, ?, 1)
       ON CONFLICT(bucket_key_hash) DO UPDATE SET
         window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END,
         attempt_count = CASE WHEN window_start <= ? THEN 1 ELSE attempt_count + 1 END
       WHERE window_start <= ? OR attempt_count < ?`,
    )
    .bind(bucket, now, cutoff, cutoff, cutoff, MAX_ATTEMPTS)
    .run();
  if (result.changes !== 1)
    throw err("RATE_LIMITED", "Too many reports. Try again in ten minutes.");
}
