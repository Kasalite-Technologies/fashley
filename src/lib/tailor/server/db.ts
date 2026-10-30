/** Minimal D1-like interface (prepare/bind/run/first/all/batch) so services are testable without a live D1 binding. */
export interface DbRunResult {
  changes: number;
  lastRowId: number | null;
}
export interface DbPrepared {
  bind(...values: unknown[]): DbPrepared;
  run(): Promise<DbRunResult>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}
export interface Db {
  prepare(sql: string): DbPrepared;
  batch(statements: DbPrepared[]): Promise<DbRunResult[]>;
  exec(sql: string): Promise<void>;
}

type Row = Record<string, unknown>;
interface TableDef {
  rows: Row[];
  uniques: string[][];
  checks: string[];
}

function splitTop(text: string, sep = ","): string[] {
  const out: string[] = [];
  let depth = 0,
    quote = false,
    cur = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quote) {
      cur += c;
      if (c === "'") quote = false;
      continue;
    }
    if (c === "'") {
      quote = true;
      cur += c;
      continue;
    }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === sep && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function balanced(text: string, start: number): { inner: string; end: number } {
  let depth = 0,
    quote = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (quote) {
      if (c === "'") quote = false;
      continue;
    }
    if (c === "'") quote = true;
    else if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (!depth) return { inner: text.slice(start + 1, i), end: i };
    }
  }
  throw new Error("unbalanced parens");
}
function literal(tok: string, params: unknown[], pi: { i: number }): unknown {
  const t = tok.trim();
  if (t === "?") return params[pi.i++];
  if (/^NULL$/i.test(t)) return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
  throw new Error(`unsupported literal: ${t}`);
}
function evalCheck(expr: string, row: Row): boolean {
  const e = expr.trim();
  // IN (...)
  const inMatch = e.match(/^(\w+)\s+IN\s*\((.*)\)$/is);
  if (inMatch)
    return splitTop(inMatch[2]!)
      .map((s) => s.trim().replace(/^'|'$/g, ""))
      .includes(String(row[inMatch[1]!]));
  const lenBetween = e.match(/^length\((\w+)\)\s+BETWEEN\s+(\d+)\s+AND\s+(\d+)$/i);
  if (lenBetween) {
    const v = String(row[lenBetween[1]!] ?? "").length;
    return v >= +lenBetween[2]! && v <= +lenBetween[3]!;
  }
  if (/json_valid/i.test(e)) {
    return e.split(/\bOR\b/i).some((part) => {
      const isNull = part.match(/(\w+)\s+IS\s+NULL/i);
      if (isNull && !/json_valid/i.test(part))
        return row[isNull[1]!] === null || row[isNull[1]!] === undefined;
      const m = part.match(/json_valid\((\w+)\)/i);
      if (!m) return true;
      const v = row[m[1]!];
      if (v === null || v === undefined) return false;
      try {
        JSON.parse(String(v));
        return true;
      } catch {
        return false;
      }
    });
  }
  // <> 'published' OR ... style compound checks with status guard: evaluate generically below via substitution
  try {
    const js = e
      .replace(/(\w+)\s+IS\s+NOT\s+NULL/gi, "($1 !== null && $1 !== undefined)")
      .replace(/(\w+)\s+IS\s+NULL/gi, "($1 === null || $1 === undefined)")
      .replace(/<>/g, "!==")
      .replace(/(?<![=!<>])=(?!=)/g, "===")
      .replace(/\bAND\b/gi, "&&")
      .replace(/\bOR\b/gi, "||")
      .replace(/\bNOT\b/gi, "!");
    const keys = Object.keys(row);
    const fn = new Function(...keys, `return (${js});`);
    return Boolean(fn(...keys.map((k) => row[k] ?? null)));
  } catch {
    return true;
  }
}

export class InMemoryDb implements Db {
  tables = new Map<string, TableDef>();
  rawSql: string[] = [];

  private table(name: string): TableDef {
    let t = this.tables.get(name);
    if (!t) {
      t = { rows: [], uniques: [], checks: [] };
      this.tables.set(name, t);
    }
    return t;
  }
  async exec(sql: string): Promise<void> {
    this.rawSql.push(sql);
    const tableRe = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(/gi;
    let m: RegExpExecArray | null;
    while ((m = tableRe.exec(sql))) {
      const open = sql.indexOf("(", m.index);
      const { inner, end } = balanced(sql, open);
      const def = this.table(m[1]!);
      const parts = splitTop(inner);
      for (const part of parts) {
        const pk = part.match(/^PRIMARY KEY\s*\(([^)]+)\)/i);
        if (pk) {
          def.uniques.push(splitTop(pk[1]!).map((s) => s.trim()));
          continue;
        }
        const uq = part.match(/^UNIQUE\s*\(([^)]+)\)/i);
        if (uq) {
          def.uniques.push(splitTop(uq[1]!).map((s) => s.trim()));
          continue;
        }
        const fm = part.match(/FOREIGN KEY/i);
        if (fm) continue;
        const ck = part.match(/CHECK\s*\(/i);
        if (/^CHECK/i.test(part) && ck) {
          def.checks.push(balanced(part, part.indexOf("(", ck.index)).inner);
          continue;
        }
        const col = part.match(/^"?(\w+)"?\s+/);
        if (!col) continue;
        if (/PRIMARY KEY/i.test(part)) def.uniques.push([col[1]!]);
        if (/\bUNIQUE\b/i.test(part)) def.uniques.push([col[1]!]);
        let idx = 0;
        while ((idx = part.indexOf("CHECK", idx)) >= 0) {
          const p = part.indexOf("(", idx);
          if (p < 0) break;
          def.checks.push(balanced(part, p).inner);
          idx = p + 1;
        }
      }
      tableRe.lastIndex = end;
    }
    const uidx = /CREATE UNIQUE INDEX (?:IF NOT EXISTS )?\w+ ON (\w+)\s*\(([^)]+)\)/gi;
    while ((m = uidx.exec(sql)))
      this.table(m[1]!).uniques.push(splitTop(m[2]!).map((s) => s.trim()));
    // Non-DDL statements in exec: execute sequentially (skip triggers).
    if (!/CREATE (TABLE|INDEX|TRIGGER|UNIQUE)/i.test(sql)) {
      for (const stmt of sql
        .split(/;\s*(?:\n|$)/)
        .map((s) => s.trim())
        .filter(Boolean)) {
        if (/^(PRAGMA|CREATE|DROP)/i.test(stmt)) continue;
        await this.prepare(stmt)
          .run()
          .catch(() => undefined);
      }
    }
  }
  prepare(sql: string): DbPrepared {
    const execute = this.execute.bind(this);
    const query = this.query.bind(this);
    let params: unknown[] = [];
    const stmt: DbPrepared = {
      bind(...v: unknown[]) {
        params = v;
        return stmt;
      },
      async run() {
        return execute(sql, params);
      },
      async first<T>() {
        const { results } = await stmt.all<T>();
        return results[0] ?? null;
      },
      async all<T>() {
        return { results: query(sql, params) as T[] };
      },
    };
    return stmt;
  }
  async batch(statements: DbPrepared[]): Promise<DbRunResult[]> {
    const snapshot = structuredClone([...this.tables.entries()]);
    // Statement run() bodies execute synchronously, so mapping without interleaved
    // awaits makes the batch a single atomic turn; restore the snapshot on any failure.
    try {
      return await Promise.all(statements.map((s) => s.run()));
    } catch (e) {
      this.tables = new Map(snapshot as [string, TableDef][]);
      throw e;
    }
  }
  private enforce(name: string, candidate: Row, ignore?: Row) {
    const def = this.table(name);
    for (const cols of def.uniques) {
      if (cols.some((c) => candidate[c] === null || candidate[c] === undefined)) continue;
      if (def.rows.some((r) => r !== ignore && cols.every((c) => r[c] === candidate[c])))
        throw new Error(`UNIQUE constraint failed: ${name}.${cols.join(",")}`);
    }
    for (const c of def.checks)
      if (!evalCheck(c, candidate)) throw new Error(`CHECK constraint failed: ${name}: ${c}`);
  }
  private where(
    whereSql: string | undefined,
    row: Row,
    params: unknown[],
    pi: { i: number },
  ): boolean {
    if (!whereSql) return true;
    return splitTop(whereSql.replace(/\bAND\b/gi, "\u0001"), "\u0001").every((raw) => {
      const cond = raw.trim();
      let m = cond.match(/^(\w+)\s+IS\s+NOT\s+NULL$/i);
      if (m) return row[m[1]!] !== null && row[m[1]!] !== undefined;
      m = cond.match(/^(\w+)\s+IS\s+NULL$/i);
      if (m) return row[m[1]!] === null || row[m[1]!] === undefined;
      m = cond.match(/^(\w+)\s*(>=|<=|<>|!=|=|>|<|LIKE)\s*(.+)$/i);
      if (!m) throw new Error(`unsupported WHERE: ${cond}`);
      const val = literal(m[3]!, params, pi);
      const actual = row[m[1]!];
      switch (m[2]!.toUpperCase()) {
        case "=":
          return actual === val;
        case "<>":
        case "!=":
          return actual !== val;
        case ">":
          return Number(actual) > Number(val);
        case ">=":
          return Number(actual) >= Number(val);
        case "<":
          return Number(actual) < Number(val);
        case "<=":
          return Number(actual) <= Number(val);
        case "LIKE":
          return String(actual ?? "")
            .toLowerCase()
            .includes(String(val).replace(/%/g, "").toLowerCase());
        default:
          return false;
      }
    });
  }
  query(sqlRaw: string, params: unknown[]): Row[] {
    const sql = sqlRaw.trim().replace(/;$/, "");
    const m = sql.match(
      /^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER BY\s+(.+?))?(?:\s+LIMIT\s+(\S+))?$/is,
    );
    if (!m) throw new Error(`unsupported SELECT: ${sql}`);
    // Each row evaluates WHERE with a fresh parameter cursor; LIMIT params follow WHERE params.
    let rows = this.table(m[2]!).rows.filter((r) => this.where(m[3], { ...r }, params, { i: 0 }));
    const pi = { i: (m[3]?.match(/\?/g) ?? []).length };
    if (m[4]) {
      const keys = splitTop(m[4]).map((p) => {
        const mm = p.trim().match(/^(\w+)(\s+(ASC|DESC))?$/i)!;
        return { col: mm[1]!, desc: /DESC/i.test(p) };
      });
      rows = [...rows].sort((a, b) => {
        for (const k of keys) {
          const d = String(a[k.col] ?? "").localeCompare(String(b[k.col] ?? ""), undefined, {
            numeric: true,
          });
          if (d) return k.desc ? -d : d;
        }
        return 0;
      });
    }
    if (m[5]) {
      const lim = m[5] === "?" ? Number(params[pi.i++]) : Number(m[5]);
      rows = rows.slice(0, lim);
    }
    if (/^COUNT\(\*\)/i.test(m[1]!.trim())) return [{ count: rows.length }];
    if (m[1]!.trim() === "*") return rows.map((r) => ({ ...r }));
    const cols = splitTop(m[1]!).map((c) => c.trim().replace(/^.*\s+AS\s+/i, ""));
    return rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
  }
  execute(sqlRaw: string, params: unknown[]): DbRunResult {
    const sql = sqlRaw.trim().replace(/;$/, "");
    let m = sql.match(/^INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\((.*)\)$/is);
    if (m) {
      const cols = splitTop(m[2]!);
      const pi = { i: 0 };
      const vals = splitTop(m[3]!).map((t) => literal(t, params, pi));
      const row: Row = Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
      this.enforce(m[1]!, row);
      this.table(m[1]!).rows.push(row);
      return { changes: 1, lastRowId: null };
    }
    m = sql.match(/^UPDATE (\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/is);
    if (m) {
      const pi = { i: 0 };
      const assigns = splitTop(m[2]!);
      // Params order in SQL is SET then WHERE; parse SET expressions lazily per row.
      let changes = 0;
      for (const row of this.table(m[1]!).rows) {
        const setPi = { i: 0 };
        const newVals: Row = {};
        for (const a of assigns) {
          const am = a.match(/^(\w+)\s*=\s*(.+)$/)!;
          const expr = am[2]!.trim();
          const inc = expr.match(/^(\w+)\s*([+-])\s*(.+)$/);
          newVals[am[1]!] = inc
            ? Number(row[am[1]!] ?? 0) +
              (inc[2] === "-" ? -1 : 1) * Number(literal(inc[3]!, params, setPi))
            : literal(expr, params, setPi);
        }
        const wherePi = { i: setPi.i };
        if (this.where(m[3], row, params, wherePi)) {
          const cand = { ...row, ...newVals };
          this.enforce(m[1]!, cand, row);
          Object.assign(row, newVals);
          changes++;
        }
        pi.i = wherePi.i;
      }
      return { changes, lastRowId: null };
    }
    m = sql.match(/^DELETE FROM (\w+)(?:\s+WHERE\s+(.+))?$/is);
    if (m) {
      const def = this.table(m[1]!);
      const before = def.rows.length;
      def.rows = def.rows.filter((r) => !this.where(m[2], r, params, { i: 0 }));
      return { changes: before - def.rows.length, lastRowId: null };
    }
    if (/^SELECT/i.test(sql)) {
      this.query(sql, params);
      return { changes: 0, lastRowId: null };
    }
    throw new Error(`unsupported SQL: ${sql}`);
  }
}
