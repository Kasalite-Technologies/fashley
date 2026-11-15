CREATE TABLE IF NOT EXISTS event_report_rate_limits (
  bucket_key_hash TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL CHECK (attempt_count BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_event_report_rate_limits_window
  ON event_report_rate_limits(window_start);
