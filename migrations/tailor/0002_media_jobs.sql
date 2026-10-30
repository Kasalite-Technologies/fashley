-- 0002: uploads, assets, jobs, step runs
PRAGMA foreign_keys = ON;

CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES tailor_projects(id) ON DELETE RESTRICT,
  owner_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('fabric_source','person_source')),
  quarantine_key TEXT NOT NULL,
  declared_mime TEXT NOT NULL,
  declared_bytes INTEGER NOT NULL CHECK (declared_bytes > 0),
  status TEXT NOT NULL CHECK (status IN ('pending','received','validating','ready','rejected','expired')),
  asset_id TEXT,
  expires_at INTEGER NOT NULL,
  failure_code TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_uploads_project ON uploads(project_id, created_at, id);
CREATE INDEX idx_uploads_owner ON uploads(owner_user_id);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES tailor_projects(id) ON DELETE RESTRICT,
  owner_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('fabric_source','fabric_crop','fabric_mask','person_source','person_crop','concept')),
  object_key TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp')),
  bytes INTEGER NOT NULL CHECK (bytes >= 0),
  width_px INTEGER NOT NULL CHECK (width_px > 0),
  height_px INTEGER NOT NULL CHECK (height_px > 0),
  sha256 TEXT NOT NULL,
  parent_asset_id TEXT REFERENCES assets(id) ON DELETE RESTRICT,
  consent_id TEXT REFERENCES consents(id) ON DELETE RESTRICT,
  origin_job_id TEXT,
  state TEXT NOT NULL CHECK (state IN ('ready','deleting','deleted')),
  retention_expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_assets_project_state ON assets(project_id, state);
CREATE INDEX idx_assets_owner ON assets(owner_user_id);

CREATE TABLE ai_jobs (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  project_id TEXT NOT NULL REFERENCES tailor_projects(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES project_revisions(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('analyze_fabric','generate_concept','assemble_brief')),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('queued','running','retry_wait','needs_attention','completed','failed','cancelled')),
  stage TEXT CHECK (stage IS NULL OR stage IN ('validating','segmenting','understanding','generating','assembling','persisting')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  workflow_id TEXT UNIQUE,
  result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  error_code TEXT,
  retryable INTEGER NOT NULL DEFAULT 0 CHECK (retryable IN (0,1)),
  reserved_credits INTEGER NOT NULL DEFAULT 0 CHECK (reserved_credits >= 0),
  cancel_requested_at INTEGER,
  deadline_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  finished_at INTEGER,
  UNIQUE (owner_user_id, idempotency_key)
);
CREATE INDEX idx_jobs_project_created ON ai_jobs(project_id, created_at, id);
CREATE INDEX idx_jobs_state_updated ON ai_jobs(state, updated_at);

CREATE TABLE ai_step_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES ai_jobs(id) ON DELETE RESTRICT,
  step_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('prepared','submitted','completed','failed','ambiguous')),
  model_id TEXT,
  prompt_version TEXT,
  provider_request_id TEXT,
  provider_file_ids_json TEXT CHECK (provider_file_ids_json IS NULL OR json_valid(provider_file_ids_json)),
  artifact_ids_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(artifact_ids_json)),
  output_json TEXT CHECK (output_json IS NULL OR json_valid(output_json)),
  usage_json TEXT CHECK (usage_json IS NULL OR json_valid(usage_json)),
  upstream_cost_minor INTEGER,
  currency TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (job_id, step_key)
);
CREATE INDEX idx_step_runs_job ON ai_step_runs(job_id);
