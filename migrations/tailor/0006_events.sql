-- 0006: fashion events directory, moderator review, native free registration,
-- admission and staff audit. Additive to the existing application chain.
--
-- Publication, review, lifecycle and registration are deliberately separate
-- columns: an approved listing staying live while a revision is reviewed must
-- not be representable as a single overloaded "status" value.
PRAGMA foreign_keys = ON;

-- Last verified Clerk email per local user, refreshed on authenticated event
-- actions. Used for staff/attendee contact display; never an identity key.
CREATE TABLE user_emails (
  user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE RESTRICT,
  email TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE organizers (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  website TEXT,
  contact_email TEXT NOT NULL,
  city TEXT,
  country TEXT,
  status TEXT NOT NULL CHECK (status IN ('active','suspended')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_organizers_owner ON organizers(owner_user_id);
CREATE INDEX idx_organizers_status ON organizers(status, name);

-- `events` carries the approved public snapshot. The draft being edited or
-- reviewed lives in `event_revisions`; the live columns are only replaced when
-- an editor approves that exact revision.
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  organizer_id TEXT NOT NULL REFERENCES organizers(id) ON DELETE RESTRICT,
  organizer_name TEXT NOT NULL,
  publication TEXT NOT NULL CHECK (publication IN ('unpublished','published','suspended','archived')),
  review_state TEXT NOT NULL CHECK (review_state IN ('draft','submitted','changes_requested','approved','rejected','withdrawn')),
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('scheduled','postponed','cancelled')),
  current_revision_id TEXT,
  approved_revision_id TEXT,
  approved_revision_no INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('in_person','online','hybrid')),
  city TEXT,
  country TEXT,
  venue TEXT,
  timezone TEXT NOT NULL DEFAULT 'Africa/Accra',
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  registration_opens_at INTEGER,
  registration_closes_at INTEGER,
  registration_closed INTEGER NOT NULL DEFAULT 0 CHECK (registration_closed IN (0,1)),
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  waitlist_enabled INTEGER NOT NULL DEFAULT 0 CHECK (waitlist_enabled IN (0,1)),
  confirmed_count INTEGER NOT NULL DEFAULT 0 CHECK (confirmed_count >= 0),
  cover_object_key TEXT,
  cover_mime TEXT,
  search_text TEXT NOT NULL DEFAULT '',
  featured_until INTEGER,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_events_directory ON events(publication, lifecycle, starts_at);
CREATE INDEX idx_events_organizer ON events(organizer_id, updated_at);
CREATE INDEX idx_events_review ON events(review_state, updated_at);
CREATE INDEX idx_events_search ON events(search_text);

CREATE TABLE event_revisions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  revision_no INTEGER NOT NULL CHECK (revision_no >= 1),
  review_state TEXT NOT NULL CHECK (review_state IN ('draft','submitted','changes_requested','approved','rejected','withdrawn')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('in_person','online','hybrid')),
  city TEXT,
  country TEXT,
  venue TEXT,
  online_url TEXT,
  timezone TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  registration_opens_at INTEGER,
  registration_closes_at INTEGER,
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  waitlist_enabled INTEGER NOT NULL DEFAULT 0 CHECK (waitlist_enabled IN (0,1)),
  access_info TEXT,
  accessibility TEXT,
  age_limit INTEGER,
  cover_object_key TEXT,
  cover_mime TEXT,
  author_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  submitted_at INTEGER,
  decided_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (event_id, revision_no)
);
CREATE INDEX idx_event_revisions_event ON event_revisions(event_id, revision_no);

CREATE TABLE event_reviews (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL REFERENCES event_revisions(id) ON DELETE RESTRICT,
  reviewer_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('approved','changes_requested','rejected')),
  organizer_message TEXT NOT NULL DEFAULT '',
  internal_note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_event_reviews_event ON event_reviews(event_id, created_at);

-- One row per person per event. `state` covers registration; admission is
-- tracked separately in event_check_ins so a re-registration never rewrites it.
CREATE TABLE event_registrations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  state TEXT NOT NULL CHECK (state IN ('confirmed','waitlisted','cancelled')),
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  answers_json TEXT NOT NULL DEFAULT '{}',
  revision_id TEXT,
  registered_at INTEGER NOT NULL,
  cancelled_at INTEGER,
  checked_in_at INTEGER,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at INTEGER NOT NULL,
  UNIQUE (event_id, user_id)
);
CREATE INDEX idx_event_registrations_event ON event_registrations(event_id, state, registered_at);
CREATE INDEX idx_event_registrations_user ON event_registrations(user_id, registered_at);

CREATE TABLE event_tickets (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL REFERENCES event_registrations(id) ON DELETE RESTRICT,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  credential TEXT NOT NULL,
  credential_hash TEXT NOT NULL UNIQUE,
  issued_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX idx_event_tickets_registration ON event_tickets(registration_id);

CREATE TABLE event_check_ins (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  registration_id TEXT NOT NULL REFERENCES event_registrations(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('check_in','undo')),
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_event_check_ins_event ON event_check_ins(event_id, created_at);

CREATE TABLE event_staff (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  granted_by TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  UNIQUE (event_id, user_id)
);

CREATE TABLE event_reports (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  reporter_email TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('misleading','duplicate','inappropriate','wrong_details','other')),
  detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('open','resolved','dismissed')),
  resolution_note TEXT NOT NULL DEFAULT '',
  resolved_by TEXT REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX idx_event_reports_status ON event_reports(status, created_at);

CREATE TABLE platform_role_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('events_editor','platform_admin')),
  granted_by TEXT REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  UNIQUE (user_id, role)
);

CREATE TABLE admin_audit_log (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES app_users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  revision_id TEXT,
  request_id TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_admin_audit_created ON admin_audit_log(created_at);

-- Durable notification intent. Delivery state is separate from the business
-- mutation: a provider outage never undoes a valid registration.
CREATE TABLE event_notification_outbox (
  id TEXT PRIMARY KEY,
  delivery_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN (
    'submission_received','changes_requested','rejected','published',
    'registration_confirmed','registration_waitlisted','promotion_confirmed',
    'registration_cancelled','event_cancelled','event_postponed','event_changed',
    'seat_available','registration_reminder'
  )),
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  registration_id TEXT,
  recipient_email TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  state TEXT NOT NULL CHECK (state IN ('pending','sent','failed','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  provider_message_id TEXT,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_event_outbox_due ON event_notification_outbox(state, next_attempt_at);
CREATE INDEX idx_event_outbox_event ON event_notification_outbox(event_id, created_at);

-- Capacity and registration-window guards are enforced by the database, not by
-- a read-then-write in JavaScript. A condition that is merely false cannot
-- abort a D1 batch, so each guard raises ABORT and the whole batch rolls back.
CREATE TRIGGER trg_events_capacity_guard
BEFORE UPDATE OF confirmed_count, capacity ON events
WHEN NEW.confirmed_count > COALESCE(NEW.capacity, NEW.confirmed_count)
BEGIN
  SELECT RAISE(ABORT, 'CAPACITY_EXCEEDED');
END;

CREATE TRIGGER trg_registration_insert_open
BEFORE INSERT ON event_registrations
WHEN NEW.state IN ('confirmed','waitlisted') AND NOT EXISTS (
  SELECT 1 FROM events e
  WHERE e.id = NEW.event_id
    AND e.publication = 'published'
    AND e.lifecycle = 'scheduled'
    AND e.registration_closed = 0
    AND e.ends_at > NEW.registered_at
    AND EXISTS (SELECT 1 FROM organizers o WHERE o.id = e.organizer_id AND o.status = 'active')
    AND (e.registration_closes_at IS NULL OR e.registration_closes_at > NEW.registered_at)
    AND (e.registration_opens_at IS NULL OR e.registration_opens_at <= NEW.registered_at)
)
BEGIN
  SELECT RAISE(ABORT, 'REGISTRATION_NOT_OPEN');
END;

-- Seat check happens on the row that becomes confirmed, before the counter
-- increment in the same batch, so a failed insert rolls back the notification
-- and the counter together instead of leaving a phantom confirmation.
CREATE TRIGGER trg_registration_insert_capacity
BEFORE INSERT ON event_registrations
WHEN NEW.state = 'confirmed' AND EXISTS (
  SELECT 1 FROM events e
  WHERE e.id = NEW.event_id
    AND e.capacity IS NOT NULL
    AND e.confirmed_count >= e.capacity
)
BEGIN
  SELECT RAISE(ABORT, 'CAPACITY_EXCEEDED');
END;

CREATE TRIGGER trg_registration_confirm_capacity
BEFORE UPDATE OF state ON event_registrations
WHEN NEW.state = 'confirmed' AND OLD.state <> 'confirmed' AND EXISTS (
  SELECT 1 FROM events e
  WHERE e.id = NEW.event_id
    AND e.capacity IS NOT NULL
    AND e.confirmed_count >= e.capacity
)
BEGIN
  SELECT RAISE(ABORT, 'CAPACITY_EXCEEDED');
END;

CREATE TRIGGER trg_registration_confirm_open
BEFORE UPDATE OF state ON event_registrations
WHEN NEW.state IN ('confirmed','waitlisted') AND OLD.state <> NEW.state AND NOT EXISTS (
  SELECT 1 FROM events e
  WHERE e.id = NEW.event_id
    AND e.publication = 'published'
    AND e.lifecycle = 'scheduled'
    AND e.registration_closed = 0
    AND e.ends_at > NEW.updated_at
    AND EXISTS (SELECT 1 FROM organizers o WHERE o.id = e.organizer_id AND o.status = 'active')
    AND (e.registration_closes_at IS NULL OR e.registration_closes_at > NEW.updated_at)
    AND (e.registration_opens_at IS NULL OR e.registration_opens_at <= NEW.updated_at)
)
BEGIN
  SELECT RAISE(ABORT, 'REGISTRATION_NOT_OPEN');
END;

-- Only one live ticket credential per registration.
CREATE UNIQUE INDEX idx_event_tickets_live ON event_tickets(registration_id) WHERE revoked_at IS NULL;

-- A review may only be recorded against the event's current revision. If an
-- editor opened an older revision, this aborts the whole batch: the decision,
-- the review row, the publish and the email either all commit or none do.
CREATE TRIGGER trg_event_review_current_revision
BEFORE INSERT ON event_reviews
WHEN NOT EXISTS (
  SELECT 1 FROM events e
  WHERE e.id = NEW.event_id
    AND e.current_revision_id = NEW.revision_id
    AND e.review_state = 'submitted'
    AND EXISTS (SELECT 1 FROM event_revisions r WHERE r.id = NEW.revision_id AND r.review_state = 'submitted')
)
BEGIN
  SELECT RAISE(ABORT, 'STALE_REVISION');
END;

-- Counters follow actual row transitions, never an earlier JavaScript read.
CREATE TRIGGER trg_registration_count_insert
AFTER INSERT ON event_registrations WHEN NEW.state = 'confirmed'
BEGIN
  UPDATE events SET confirmed_count = confirmed_count + 1 WHERE id = NEW.event_id;
END;
CREATE TRIGGER trg_registration_count_update
AFTER UPDATE OF state ON event_registrations WHEN OLD.state <> NEW.state
BEGIN
  UPDATE events SET confirmed_count = confirmed_count
    + CASE WHEN NEW.state = 'confirmed' THEN 1 ELSE 0 END
    - CASE WHEN OLD.state = 'confirmed' THEN 1 ELSE 0 END
  WHERE id = NEW.event_id;
END;

-- Services bind the next version calculated from the row they actually read.
-- A stale write aborts its entire batch, including tickets and notifications.
CREATE TRIGGER trg_registration_version
BEFORE UPDATE OF version ON event_registrations WHEN NEW.version <> OLD.version + 1
BEGIN
  SELECT RAISE(ABORT, 'STALE_WRITE');
END;
CREATE TRIGGER trg_event_version
BEFORE UPDATE OF version ON events WHEN NEW.version <> OLD.version + 1
BEGIN
  SELECT RAISE(ABORT, 'STALE_WRITE');
END;

CREATE TRIGGER trg_waitlist_insert
BEFORE INSERT ON event_registrations
WHEN NEW.state = 'waitlisted' AND NOT EXISTS (
  SELECT 1 FROM events WHERE id = NEW.event_id AND waitlist_enabled = 1
    AND capacity IS NOT NULL AND confirmed_count >= capacity
)
BEGIN
  SELECT RAISE(ABORT, 'WAITLIST_NOT_OPEN');
END;
CREATE TRIGGER trg_waitlist_update
BEFORE UPDATE OF state ON event_registrations
WHEN NEW.state = 'waitlisted' AND OLD.state <> 'waitlisted' AND NOT EXISTS (
  SELECT 1 FROM events WHERE id = NEW.event_id AND waitlist_enabled = 1
    AND capacity IS NOT NULL AND confirmed_count >= capacity
)
BEGIN
  SELECT RAISE(ABORT, 'WAITLIST_NOT_OPEN');
END;

CREATE TRIGGER trg_last_platform_admin
BEFORE UPDATE OF revoked_at ON platform_role_grants
WHEN OLD.role = 'platform_admin' AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
  AND (SELECT COUNT(*) FROM platform_role_grants WHERE role = 'platform_admin' AND revoked_at IS NULL) <= 1
BEGIN
  SELECT RAISE(ABORT, 'LAST_PLATFORM_ADMIN');
END;

CREATE TRIGGER trg_revision_content_immutable
BEFORE UPDATE OF title, summary, description, category, format, city, country, venue,
  online_url, timezone, starts_at, ends_at, registration_opens_at, registration_closes_at,
  capacity, waitlist_enabled, access_info, accessibility, age_limit, cover_object_key, cover_mime
ON event_revisions
WHEN OLD.review_state NOT IN ('draft','changes_requested')
BEGIN
  SELECT RAISE(ABORT, 'STALE_REVISION');
END;

CREATE TRIGGER trg_check_in_open
BEFORE UPDATE OF checked_in_at ON event_registrations
WHEN NEW.checked_in_at IS NOT NULL AND OLD.checked_in_at IS NULL AND (
  NEW.state <> 'confirmed' OR NOT EXISTS (
    SELECT 1 FROM events e JOIN organizers o ON o.id = e.organizer_id
    WHERE e.id = NEW.event_id AND e.publication = 'published'
      AND e.lifecycle = 'scheduled' AND o.status = 'active'
  )
)
BEGIN
  SELECT RAISE(ABORT, 'REGISTRATION_NOT_OPEN');
END;

CREATE TRIGGER trg_publication_active_organizer
BEFORE UPDATE OF publication ON events
WHEN NEW.publication = 'published' AND NOT EXISTS (
  SELECT 1 FROM organizers WHERE id = NEW.organizer_id AND status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'ORGANIZER_SUSPENDED');
END;
