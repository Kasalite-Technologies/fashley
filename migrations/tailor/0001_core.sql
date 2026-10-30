-- Fashley Tailor 0001: identity, preferences, templates, projects, drafts, revisions, measurements, consents
PRAGMA foreign_keys = ON;

CREATE TABLE app_users (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('active','disabled','deletion_pending')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE auth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider IN ('clerk','supabase_legacy')),
  subject TEXT NOT NULL,
  link_method TEXT NOT NULL CHECK (link_method IN ('verified_signin','verified_import','verified_claim')),
  link_audit_id TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (provider, subject)
);
CREATE INDEX idx_auth_identities_user ON auth_identities(user_id);

CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE RESTRICT,
  measurement_unit TEXT NOT NULL CHECK (measurement_unit IN ('cm','in')),
  timezone TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE garment_templates (
  id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  status TEXT NOT NULL CHECK (status IN ('draft','published','retired')),
  name TEXT NOT NULL,
  garment_kind TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  illustration_key TEXT,
  measurement_schema_json TEXT NOT NULL CHECK (json_valid(measurement_schema_json)),
  design_options_json TEXT NOT NULL CHECK (json_valid(design_options_json)),
  rule_json TEXT CHECK (rule_json IS NULL OR json_valid(rule_json)),
  reviewer_name TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (id, version),
  CHECK (status <> 'published' OR rule_json IS NULL OR (reviewer_name IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX idx_templates_status ON garment_templates(status, id, version);

CREATE TABLE tailor_projects (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  status TEXT NOT NULL CHECK (status IN ('active','archived','deleting','deleted')),
  current_revision_id TEXT,
  latest_brief_id TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX idx_projects_owner_status_updated ON tailor_projects(owner_user_id, status, updated_at, id);

CREATE TABLE project_drafts (
  project_id TEXT PRIMARY KEY REFERENCES tailor_projects(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  base_revision_id TEXT,
  input_json TEXT NOT NULL CHECK (json_valid(input_json)),
  updated_at INTEGER NOT NULL
);

CREATE TABLE project_revisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES tailor_projects(id) ON DELETE RESTRICT,
  revision_number INTEGER NOT NULL CHECK (revision_number >= 1),
  draft_version INTEGER NOT NULL,
  template_id TEXT,
  template_version INTEGER,
  input_json TEXT NOT NULL CHECK (json_valid(input_json)),
  input_hash TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  UNIQUE (project_id, revision_number),
  FOREIGN KEY (template_id, template_version) REFERENCES garment_templates(id, version) ON DELETE RESTRICT
);
CREATE INDEX idx_revisions_project_number ON project_revisions(project_id, revision_number);

-- Deferred pointer FKs (added as triggers are not possible for FK; enforced in services + indexes).
CREATE INDEX idx_projects_current_revision ON tailor_projects(current_revision_id);
CREATE INDEX idx_drafts_base_revision ON project_drafts(base_revision_id);

CREATE TABLE revision_measurements (
  id TEXT PRIMARY KEY,
  revision_id TEXT NOT NULL REFERENCES project_revisions(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('body','garment')),
  value_mm INTEGER CHECK (value_mm IS NULL OR value_mm > 0),
  entered_value TEXT,
  entered_unit TEXT NOT NULL CHECK (entered_unit IN ('mm','cm','in')),
  source TEXT NOT NULL CHECK (source IN ('customer_manual','tailor_manual','experimental_photo_estimate')),
  source_asset_id TEXT,
  recorded_at INTEGER NOT NULL,
  UNIQUE (revision_id, name)
);
CREATE INDEX idx_revision_measurements_revision ON revision_measurements(revision_id);

CREATE TABLE consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  project_id TEXT REFERENCES tailor_projects(id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL CHECK (purpose IN ('ai_fabric','ai_person','tailor_share','public_demo')),
  policy_version TEXT NOT NULL,
  scope_json TEXT NOT NULL CHECK (json_valid(scope_json)),
  granted_at INTEGER NOT NULL,
  withdrawn_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_consents_user_purpose ON consents(user_id, purpose, withdrawn_at);
CREATE INDEX idx_consents_project ON consents(project_id);
