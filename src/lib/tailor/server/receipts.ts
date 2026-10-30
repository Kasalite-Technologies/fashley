import type { Db } from "./db";
import { err } from "./errors";
import { hashPayload, nowMs } from "./util";
import { newId } from "./errors";

export interface Receipt {
  response: unknown;
}
/** Idempotency receipts: same key+same payload replays; different payload conflicts. Callers must redact secrets before storing. */
export async function checkReceipt(
  db: Db,
  actorScope: string,
  operation: string,
  key: string,
  payload: unknown,
): Promise<Receipt | null> {
  const requestHash = await hashPayload(payload);
  const row = await db
    .prepare(
      "SELECT * FROM mutation_receipts WHERE actor_scope = ? AND operation = ? AND idempotency_key = ?",
    )
    .bind(actorScope, operation, key)
    .first<{ request_hash: string; response_json: string }>();
  if (!row) return null;
  if (row.request_hash !== requestHash)
    throw err(
      "IDEMPOTENCY_CONFLICT",
      "This Idempotency-Key was already used with a different request.",
    );
  return { response: JSON.parse(row.response_json) };
}
export async function storeReceipt(
  db: Db,
  actorScope: string,
  operation: string,
  key: string,
  payload: unknown,
  response: unknown,
): Promise<void> {
  const now = nowMs();
  await db
    .prepare(
      "INSERT INTO mutation_receipts (id, actor_scope, operation, idempotency_key, request_hash, response_json, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      newId("rcp"),
      actorScope,
      operation,
      key,
      await hashPayload(payload),
      JSON.stringify(response),
      now,
      now + 86_400_000,
    )
    .run();
}
export async function requireIdempotencyKey(key: string | null | undefined): Promise<string> {
  if (!key || !/^[\x21-\x7E]{16,128}$/.test(key))
    throw err("INVALID_INPUT", "Idempotency-Key header (16-128 printable ASCII) is required.");
  return key;
}
