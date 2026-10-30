-- 0003: briefs, share grants, review sessions/actions, attestations, rate limits
PRAGMA foreign_keys = ON;

CREATE TABLE brief_revisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES tailor_projects(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES project_revisions(id) ON DELETE RESTRICT,
  brief_number INTEGER NOT NULL CHECK (brief_number >= 1),
  assembly_job_id TEXT UNIQUE REFERENCES ai_jobs(id) ON DELETE RESTRICT,
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  content_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('draft','finalized','superseded')),
  finalized_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE (project_id, brief_number)
);
CREATE INDEX idx_briefs_project_number ON brief_revisions(project_id, brief_number);

CREATE TABLE brief_assets (
  brief_id TEXT NOT NULL REFERENCES brief_revisions(id) ON DELETE RESTRICT,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('swatch','concept','person_reference')),
  PRIMARY KEY (brief_id, asset_id)
);
CREATE INDEX idx_brief_assets_asset ON brief_assets(asset_id);

CREATE TABLE share_grants (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL REFERENCES brief_revisions(id) ON DELETE RESTRICT,
  owner_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  allowed_actions_json TEXT NOT NULL CHECK (json_valid(allowed_actions_json)),
  include_measurements INTEGER NOT NULL CHECK (include_measurements IN (0,1)),
  permitted_asset_ids_json TEXT NOT NULL CHECK (json_valid(permitted_asset_ids_json)),
  consent_id TEXT NOT NULL REFERENCES consents(id) ON DELETE RESTRICT,
  pin_hash TEXT,
  failed_pin_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_pin_attempts >= 0),
  pin_blocked_until INTEGER,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_shares_brief_active ON share_grants(brief_id, revoked_at, expires_at);

CREATE TABLE review_sessions (
  id TEXT PRIMARY KEY,
  grant_id TEXT NOT NULL REFERENCES share_grants(id) ON DELETE RESTRICT,
  session_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_review_sessions_grant ON review_sessions(grant_id);

CREATE TABLE review_rate_limits (
  bucket_key_hash TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  blocked_until INTEGER
);

CREATE TABLE review_actions (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL REFERENCES brief_revisions(id) ON DELETE RESTRICT,
  grant_id TEXT NOT NULL REFERENCES share_grants(id) ON DELETE RESTRICT,
  session_id TEXT NOT NULL REFERENCES review_sessions(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('request_changes','approve_design','verify_measurements','accept_brief')),
  expected_content_hash TEXT NOT NULL,
  reviewer_name TEXT NOT NULL CHECK (length(reviewer_name) BETWEEN 1 AND 100),
  credential_type TEXT NOT NULL CHECK (credential_type IN ('possession_link','link_and_pin','clerk_verified')),
  reviewer_user_id TEXT REFERENCES app_users(id) ON DELETE RESTRICT,
  note TEXT,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (session_id, idempotency_key)
);
CREATE INDEX idx_review_actions_brief_created ON review_actions(brief_id, created_at, id);

CREATE TABLE measurement_attestations (
  id TEXT PRIMARY KEY,
  review_action_id TEXT NOT NULL REFERENCES review_actions(id) ON DELETE RESTRICT,
  measurement_id TEXT NOT NULL REFERENCES revision_measurements(id) ON DELETE RESTRICT,
  value_mm INTEGER NOT NULL CHECK (value_mm > 0),
  kind TEXT NOT NULL CHECK (kind IN ('body','garment')),
  method TEXT NOT NULL CHECK (method IN ('in_person_tape','reviewed_record')),
  created_at INTEGER NOT NULL,
  UNIQUE (review_action_id, measurement_id)
);
CREATE INDEX idx_attestations_measurement ON measurement_attestations(measurement_id);
