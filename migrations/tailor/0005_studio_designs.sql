-- Studio designs saved by signed-in users (Clerk identity via app_users).
-- Images live in private R2 under studio/<user_id>/<design_id>; this table
-- holds only metadata and the object key.
CREATE TABLE IF NOT EXISTS studio_designs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users (id),
  kind TEXT NOT NULL,
  category TEXT NOT NULL,
  style TEXT NOT NULL,
  occasion TEXT NOT NULL DEFAULT '',
  hardware TEXT NOT NULL DEFAULT 'None',
  notes TEXT NOT NULL DEFAULT '',
  object_key TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'image/png',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_studio_designs_user_created
  ON studio_designs (user_id, created_at DESC);
