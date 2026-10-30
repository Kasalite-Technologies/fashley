-- 0004: credits, idempotency receipts, audit, cleanup. One terminal settlement enforced by
-- reservation PK + state-transition trigger + unique ledger operation_key + account guard trigger.
PRAGMA foreign_keys = ON;

CREATE TABLE credit_accounts (
  user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE RESTRICT,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= balance),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE credit_reservations (
  job_id TEXT PRIMARY KEY REFERENCES ai_jobs(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  state TEXT NOT NULL CHECK (state IN ('held','debited','released')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_credit_reservations_user ON credit_reservations(user_id, state);

CREATE TABLE credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  job_id TEXT REFERENCES ai_jobs(id) ON DELETE RESTRICT,
  operation_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('pilot_grant','legacy_import','reserve','debit','release')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  created_at INTEGER NOT NULL,
  audit_ref TEXT
);
CREATE INDEX idx_credit_ledger_user_created ON credit_ledger(user_id, created_at, id);

CREATE TABLE mutation_receipts (
  id TEXT PRIMARY KEY,
  actor_scope TEXT NOT NULL,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  UNIQUE (actor_scope, operation, idempotency_key)
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES tailor_projects(id) ON DELETE RESTRICT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user','reviewer','system')),
  actor_id TEXT,
  operation TEXT NOT NULL,
  record_id TEXT,
  revision_id TEXT,
  request_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json)),
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_audit_project_created ON audit_events(project_id, created_at, id);

CREATE TABLE cleanup_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES tailor_projects(id) ON DELETE RESTRICT,
  target_type TEXT NOT NULL CHECK (target_type IN ('r2_object','provider_file','project_metadata')),
  target_ref TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending','running','completed','retry_wait','blocked')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at INTEGER,
  last_error_code TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (target_type, target_ref)
);
CREATE INDEX idx_cleanup_state_next ON cleanup_tasks(state, next_attempt_at);

-- Accounting guards: a conditional account update that would over-reserve aborts the whole batch/statement.
CREATE TRIGGER trg_credit_accounts_guard
BEFORE UPDATE ON credit_accounts
WHEN NEW.balance < 0 OR NEW.reserved < 0 OR NEW.reserved > NEW.balance
BEGIN SELECT RAISE(ABORT, 'credit_account_invariant'); END;

CREATE TRIGGER trg_credit_reservation_terminal_once
BEFORE UPDATE OF state ON credit_reservations
WHEN OLD.state <> 'held' AND NEW.state <> OLD.state
BEGIN SELECT RAISE(ABORT, 'credit_reservation_terminal'); END;

CREATE TRIGGER trg_credit_ledger_append_only_update
BEFORE UPDATE ON credit_ledger
BEGIN SELECT RAISE(ABORT, 'credit_ledger_append_only'); END;

CREATE TRIGGER trg_credit_ledger_append_only_delete
BEFORE DELETE ON credit_ledger
BEGIN SELECT RAISE(ABORT, 'credit_ledger_append_only'); END;

CREATE TRIGGER trg_review_actions_append_only_update
BEFORE UPDATE ON review_actions
BEGIN SELECT RAISE(ABORT, 'review_actions_append_only'); END;

CREATE TRIGGER trg_project_revisions_immutable
BEFORE UPDATE ON project_revisions
BEGIN SELECT RAISE(ABORT, 'project_revisions_immutable'); END;

CREATE TRIGGER trg_brief_revisions_content_immutable
BEFORE UPDATE OF content_json, content_hash ON brief_revisions
BEGIN SELECT RAISE(ABORT, 'brief_content_immutable'); END;
