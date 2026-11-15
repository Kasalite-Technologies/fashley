import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Db, DbPrepared, DbRunResult } from "@/lib/tailor/server/db";
import { ensureLocalUser } from "@/lib/tailor/server/identity";

/**
 * Test database backed by real SQLite (node:sqlite), so constraints, CHECKs,
 * triggers and batch rollback behave the way they will on D1. The in-memory
 * adapter used by the tailor tests does not evaluate triggers, which is exactly
 * where the events capacity guarantee lives.
 */

interface StatementLike {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

interface DatabaseLike {
  prepare(sql: string): StatementLike;
  exec(sql: string): void;
  close(): void;
}

// node:sqlite is only available from Node 22.5+. Imported lazily so an older
// runtime fails the suite with a clear message instead of a syntax error.
async function openDatabase(path: string): Promise<DatabaseLike> {
  const mod = (await import("node:sqlite")) as unknown as {
    DatabaseSync: new (file: string) => DatabaseLike;
  };
  return new mod.DatabaseSync(path);
}

class SqlitePrepared implements DbPrepared {
  constructor(private readonly stmt: StatementLike) {}
  bind(): DbPrepared {
    throw new Error("Use the bound() helper.");
  }
  async run(): Promise<DbRunResult> {
    const result = this.stmt.run();
    return { changes: Number(result.changes), lastRowId: null };
  }
  async first<T>(): Promise<T | null> {
    return (this.stmt.get() as T | undefined) ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.stmt.all() as T[] };
  }
}

/**
 * Statement wrapper that binds parameters before execution and records the
 * SQL so batch() can re-run the exact statements inside one transaction.
 */
class ReplayPrepared implements DbPrepared {
  constructor(
    private readonly db: DatabaseLike,
    public readonly sql: string,
    public readonly params: unknown[] = [],
  ) {}
  bind(...values: unknown[]): DbPrepared {
    return new ReplayPrepared(this.db, this.sql, values);
  }
  private statement(): StatementLike {
    const stmt = this.db.prepare(this.sql);
    return {
      run: (...args: unknown[]) => stmt.run(...(args.length ? args : this.params)),
      get: (...args: unknown[]) => stmt.get(...(args.length ? args : this.params)),
      all: (...args: unknown[]) => stmt.all(...(args.length ? args : this.params)),
    } as StatementLike;
  }
  async run(): Promise<DbRunResult> {
    const result = this.statement().run();
    return { changes: Number(result.changes), lastRowId: null };
  }
  async first<T>(): Promise<T | null> {
    return (this.statement().get() as T | undefined) ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.statement().all() as T[] };
  }
}

export async function createTestDb(): Promise<{
  db: Db;
  raw: DatabaseLike;
  close(): Promise<void>;
}> {
  const raw = await openDatabase(":memory:");
  raw.exec("PRAGMA foreign_keys = ON;");
  const files = [
    "0001_core.sql",
    "0002_media_jobs.sql",
    "0003_briefs_shares_reviews.sql",
    "0004_credits_receipts_audit.sql",
    "0005_studio_designs.sql",
    "0006_events.sql",
    "0007_event_report_rate_limits.sql",
  ];
  for (const file of files) {
    const sql = readFileSync(join(process.cwd(), "migrations", "tailor", file), "utf8");
    raw.exec(sql);
  }

  const db: Db = {
    prepare(sql: string) {
      return new ReplayPrepared(raw, sql);
    },
    async batch(statements: DbPrepared[]) {
      // Mirrors D1 batch(): one transaction, all or nothing. A RAISE(ABORT)
      // inside a trigger rolls the whole batch back.
      raw.exec("BEGIN");
      try {
        const results: DbRunResult[] = [];
        for (const statement of statements) {
          results.push(await statement.run());
        }
        raw.exec("COMMIT");
        return results;
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
    async exec(sql: string) {
      raw.exec(sql);
    },
  };
  return { db, raw, close: async () => raw.close() };
}

export async function seedUser(db: Db, subject: string, email: string) {
  const { userId } = await ensureLocalUser(db, {
    subject,
    displayName: subject,
    email,
    emailVerified: true,
  });
  await db
    .prepare(
      "INSERT INTO user_emails (user_id, email, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET email = excluded.email",
    )
    .bind(userId, email, Date.now())
    .run();
  return userId;
}

export { SqlitePrepared };
