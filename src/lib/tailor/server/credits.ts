import type { Db } from "./db";
import { err, newId } from "./errors";
import { nowMs } from "./util";

export async function getAccount(db: Db, userId: string) {
  const a = await db
    .prepare("SELECT * FROM credit_accounts WHERE user_id = ?")
    .bind(userId)
    .first<{ balance: number; reserved: number }>();
  if (!a) throw err("NOT_FOUND", "Credit account not found.");
  return { balance: a.balance, reserved: a.reserved, available: a.balance - a.reserved };
}
/** Server-only pilot grant (no public endpoint). Idempotent by operationKey. */
export async function pilotGrant(db: Db, userId: string, amount: number, operationKey: string) {
  const existing = await db
    .prepare("SELECT * FROM credit_ledger WHERE operation_key = ?")
    .bind(operationKey)
    .first();
  if (existing) return getAccount(db, userId);
  const now = nowMs();
  await db.batch([
    db
      .prepare(
        "UPDATE credit_accounts SET balance = balance + ?, version = version + 1, updated_at = ? WHERE user_id = ?",
      )
      .bind(amount, now, userId),
    db
      .prepare(
        "INSERT INTO credit_ledger (id, user_id, job_id, operation_key, kind, amount, created_at, audit_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(newId("led"), userId, null, operationKey, "pilot_grant", amount, now, null),
  ]);
  return getAccount(db, userId);
}
/**
 * Atomic reserve: batch(reservation insert + conditional account hold + ledger reserve).
 * The credit_accounts CHECK/trigger (reserved <= balance) aborts the batch when funds are insufficient,
 * so no partial reservation/ledger survives. Exactly-one terminal settlement via reservation state guard
 * + unique ledger operation keys (`settle:<jobId>:debit|release`).
 */
export async function reserveCredits(
  db: Db,
  input: { userId: string; jobId: string; amount: number },
) {
  const existing = await db
    .prepare("SELECT * FROM credit_reservations WHERE job_id = ?")
    .bind(input.jobId)
    .first<{ state: string; amount: number }>();
  if (existing)
    return {
      state: existing.state as "held" | "debited" | "released",
      amount: existing.amount,
      replayed: true,
    };
  if (input.amount < 0) throw err("INVALID_INPUT", "Amount must be non-negative.");
  const now = nowMs();
  try {
    await db.batch([
      db
        .prepare(
          "INSERT INTO credit_reservations (job_id, user_id, amount, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(input.jobId, input.userId, input.amount, "held", now, now),
      db
        .prepare(
          "UPDATE credit_accounts SET reserved = reserved + ?, version = version + 1, updated_at = ? WHERE user_id = ?",
        )
        .bind(input.amount, now, input.userId),
      db
        .prepare(
          "INSERT INTO credit_ledger (id, user_id, job_id, operation_key, kind, amount, created_at, audit_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          newId("led"),
          input.userId,
          input.jobId,
          `reserve:${input.jobId}`,
          "reserve",
          input.amount,
          now,
          null,
        ),
    ]);
  } catch {
    const acct = await getAccount(db, input.userId).catch(() => null);
    if (!acct || acct.available < input.amount)
      throw err("BUDGET_EXCEEDED", "Insufficient credits for this job.");
    throw err("IDEMPOTENCY_CONFLICT", "A reservation already exists for this job.");
  }
  return { state: "held" as const, amount: input.amount, replayed: false };
}
export async function settleCredits(
  db: Db,
  input: { userId: string; jobId: string; outcome: "debit" | "release" },
) {
  const r = await db
    .prepare("SELECT * FROM credit_reservations WHERE job_id = ?")
    .bind(input.jobId)
    .first<{ state: string; amount: number; user_id: string }>();
  if (!r) throw err("NOT_FOUND", "Credit reservation not found.");
  if (r.user_id !== input.userId) throw err("NOT_FOUND", "Credit reservation not found.");
  if (r.state !== "held")
    return { state: r.state as "debited" | "released", amount: r.amount, replayed: true };
  const now = nowMs();
  const kind = input.outcome === "debit" ? "debit" : "release";
  const stmts =
    input.outcome === "debit"
      ? [
          db
            .prepare(
              "UPDATE credit_reservations SET state = ?, updated_at = ? WHERE job_id = ? AND state = ?",
            )
            .bind("debited", now, input.jobId, "held"),
          db
            .prepare(
              "UPDATE credit_accounts SET balance = balance - ?, reserved = reserved - ?, version = version + 1, updated_at = ? WHERE user_id = ?",
            )
            .bind(r.amount, r.amount, now, input.userId),
          db
            .prepare(
              "INSERT INTO credit_ledger (id, user_id, job_id, operation_key, kind, amount, created_at, audit_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(
              newId("led"),
              input.userId,
              input.jobId,
              `settle:${input.jobId}:debit`,
              kind,
              r.amount,
              now,
              null,
            ),
        ]
      : [
          db
            .prepare(
              "UPDATE credit_reservations SET state = ?, updated_at = ? WHERE job_id = ? AND state = ?",
            )
            .bind("released", now, input.jobId, "held"),
          db
            .prepare(
              "UPDATE credit_accounts SET reserved = reserved - ?, version = version + 1, updated_at = ? WHERE user_id = ?",
            )
            .bind(r.amount, now, input.userId),
          db
            .prepare(
              "INSERT INTO credit_ledger (id, user_id, job_id, operation_key, kind, amount, created_at, audit_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(
              newId("led"),
              input.userId,
              input.jobId,
              `settle:${input.jobId}:release`,
              kind,
              r.amount,
              now,
              null,
            ),
        ];
  await db.batch(stmts);
  return {
    state: (input.outcome === "debit" ? "debited" : "released") as "debited" | "released",
    amount: r.amount,
    replayed: false,
  };
}
