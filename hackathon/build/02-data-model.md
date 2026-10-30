# 02 — D1 data model

## Storage conventions

- Native D1 SQLite; opaque application-generated text IDs; UTC timestamps as integer epoch milliseconds. DTO timestamps are ISO-8601 strings. Dates such as event deadlines use `YYYY-MM-DD` plus project timezone `Africa/Accra` initially.
- Lengths are integer millimeters; entered decimal value is retained as a string plus original unit `mm|cm|in|yd`. Round conversion once at validation; retain the entered value for audit. Never treat missing as zero.
- JSON is TEXT validated by shared schemas before persistence and `json_valid` checks where supported; SQL `CHECK`, `NOT NULL`, foreign keys and unique indexes enforce invariants. Enable/test foreign-key enforcement in D1 migrations.
- All owner queries join/check a non-deleted project and active user. D1 does not inherit Supabase RLS. IDs are not authorization.
- Foreign keys normally RESTRICT. Deletion is a tracked purge, not uncontrolled cascading loss of audit/accounting records. Index every project/owner FK and hot cursor query.
- `created_at`, `updated_at` apply to mutable records. Append-only records have `created_at` only. JSON snapshots have `schemaVersion: 1`.

## Relationships

```text
app_users → auth_identities / user_preferences / consents / credit_accounts
app_users → tailor_projects → project_drafts
                          → project_revisions → revision_measurements
                                              → ai_jobs → ai_step_runs
                                              → brief_revisions
                          → assets / uploads / audit_events
brief_revisions → brief_assets → assets
                → share_grants → review_sessions
                → review_actions → measurement_attestations
ai_jobs → credit_reservations → credit_ledger
tailor_projects → cleanup_tasks
garment_templates → immutable template version referenced by revisions
```

## Table dictionary

`?` means nullable; `JSON` means validated TEXT. All record IDs are TEXT primary keys unless a composite key is specified.

| Table | Fields and constraints |
| --- | --- |
| `app_users` | `id`, `status: active|disabled|deletion_pending`, timestamps. No passwords. Stable ID across identity changes. |
| `auth_identities` | `id`, `user_id FK`, `provider: clerk|supabase_legacy`, `subject`, `link_method: verified_signin|verified_import|verified_claim`, `link_audit_id?`, `created_at`; UNIQUE(provider,subject). Legacy mapping is not an accepted new-route login mechanism. |
| `user_preferences` | `user_id PK/FK`, `measurement_unit: cm|in`, `timezone`, `version INTEGER`, timestamps. Unit is a display default, not data conversion on save. |
| `garment_templates` | `id` (logical template ID), `version INTEGER`, `status: draft|published|retired`, `name`, `garment_kind`, `description`, `illustration_key?` (public approved asset), `measurement_schema_json`, `design_options_json`, `rule_json?`, `reviewer_name?`, `reviewed_at?`, `created_at`; PK(id,version). Published rows immutable; publishing requires actual review provenance. No unreviewed numerical rule presented as published. |
| `tailor_projects` | `id`, `owner_user_id FK`, `title`, `status: active|archived|deleting|deleted`, `current_revision_id? FK`, `latest_brief_id? FK`, `version INTEGER DEFAULT 1`, timestamps, `deleted_at?`; soft deletion blocks all access immediately. Title is denormalized from latest saved draft for lists. |
| `project_drafts` | `project_id PK/FK`, `version INTEGER DEFAULT 1`, `base_revision_id?`, `input_json`, `updated_at`; mutable incomplete intake only. No generated truth or approval flags. No browser-only source of truth. |
| `project_revisions` | `id`, `project_id FK`, `revision_number INTEGER`, `draft_version`, `template_id`, `template_version` composite FK, `input_json`, `input_hash`, `created_by FK`, `created_at`; UNIQUE(project_id,revision_number). Immutable once inserted. Input includes selected assets, design preferences, fabric dimensions/properties, notes and confirmed observations. |
| `revision_measurements` | `id`, `revision_id FK`, `name`, `kind: body|garment`, `value_mm? INTEGER CHECK(value_mm>0 OR value_mm IS NULL)`, `entered_value?`, `entered_unit`, `source: customer_manual|tailor_manual|experimental_photo_estimate`, `source_asset_id? FK`, `recorded_at`; UNIQUE(revision_id,name). Immutable input values; verification derives from separate same-brief attestations, not a mutable flag or inherited approval. |
| `consents` | `id`, `user_id FK`, `project_id? FK`, `purpose: ai_fabric|ai_person|tailor_share|public_demo`, `policy_version`, `scope_json` (exact asset/data scope), `granted_at`, `withdrawn_at?`; withdrawal append-audited and blocks new processing/sharing for that scope. Public-demo consent is not implied by other purposes. |
| `uploads` | `id`, `project_id FK`, `owner_user_id FK`, `kind: fabric_source|person_source`, `quarantine_key`, `declared_mime`, `declared_bytes`, `status: pending|received|validating|ready|rejected|expired`, `asset_id? FK`, `expires_at`, `failure_code?`, timestamps. One completed upload yields at most one sanitized asset. |
| `assets` | `id`, `project_id FK`, `owner_user_id FK`, `kind: fabric_source|fabric_crop|fabric_mask|person_source|person_crop|concept`, `object_key UNIQUE`, `mime`, `bytes`, `width_px`, `height_px`, `sha256`, `parent_asset_id? FK`, `consent_id? FK`, `origin_job_id?`, `state: ready|deleting|deleted`, `retention_expires_at?`, timestamps. Keys are server-only; no durable public URLs. Derived assets inherit consent restrictions. |
| `ai_jobs` | `id`, `owner_user_id FK`, `project_id FK`, `revision_id FK`, `type: analyze_fabric|generate_concept|assemble_brief`, `idempotency_key`, `request_hash`, `state`, `stage`, `attempt_count`, `workflow_id? UNIQUE`, `result_json?`, `error_code?`, `retryable INTEGER`, `reserved_credits INTEGER`, `cancel_requested_at?`, `deadline_at`, timestamps, `finished_at?`; UNIQUE(owner_user_id,idempotency_key). |
| `ai_step_runs` | `id`, `job_id FK`, `step_key`, `state: prepared|submitted|completed|failed|ambiguous`, `model_id?`, `prompt_version?`, `provider_request_id?`, `provider_file_ids_json?`, `artifact_ids_json`, `output_json?`, `usage_json?`, `upstream_cost_minor?`, `currency?`, `attempt_count`, timestamps; UNIQUE(job_id,step_key). Provider attempts are redacted audit events, not duplicate logical steps. |
| `brief_revisions` | `id`, `project_id FK`, `revision_id FK`, `brief_number`, `assembly_job_id FK UNIQUE`, `content_json`, `content_hash`, `state: draft|finalized|superseded`, `finalized_at?`, `created_at`; UNIQUE(project_id,brief_number). Assembly result is immutable content; finalization freezes sharing eligibility. Content edits require a new input revision and assembly. |
| `brief_assets` | `brief_id FK`, `asset_id FK`, `role: swatch|concept|person_reference`, PK(brief_id,asset_id). Defines explicit reference set; share subset cannot exceed it. |
| `share_grants` | `id`, `brief_id FK`, `owner_user_id FK`, `token_hash UNIQUE`, `token_prefix` (non-secret hint), `allowed_actions_json`, `include_measurements INTEGER`, `permitted_asset_ids_json`, `consent_id FK`, `pin_hash?`, `expires_at`, `revoked_at?`, `created_at`. Raw token returned only at creation. |
| `review_sessions` | `id`, `grant_id FK`, `session_hash UNIQUE`, `expires_at`, `revoked_at?`, `created_at`; no raw cookie value. Valid only while underlying grant remains valid; expiry no later than grant expiry. |
| `review_rate_limits` | `bucket_key_hash PK`, `window_start`, `attempt_count`, `blocked_until?`; rate-limit token exchanges/PIN using trusted request metadata + token hash. Atomic updates; bounded TTL cleanup. No raw IP/token persistence. |
| `review_actions` | `id`, `brief_id FK`, `grant_id FK`, `session_id FK`, `action: request_changes|approve_design|verify_measurements|accept_brief`, `expected_content_hash`, `reviewer_name`, `credential_type: possession_link|link_and_pin|clerk_verified`, `reviewer_user_id? FK`, `note?`, `idempotency_key`, `request_hash`, `created_at`; UNIQUE(session_id,idempotency_key). Append-only. A typed name is asserted, not verified. |
| `measurement_attestations` | `id`, `review_action_id FK`, `measurement_id FK`, `value_mm`, `kind`, `method: in_person_tape|reviewed_record`, `created_at`; UNIQUE(review_action_id,measurement_id). Must reference that action's exact brief input revision and exact recorded value. Estimates require a new manual value before verification. |
| `credit_accounts` | `user_id PK/FK`, `balance INTEGER CHECK(balance>=0)`, `reserved INTEGER CHECK(reserved>=0 AND reserved<=balance)`, `version INTEGER`, timestamps. Available=balance-reserved. Server-only credits; no public grant-credit route. |
| `credit_reservations` | `job_id PK/FK`, `user_id FK`, `amount INTEGER CHECK(amount>=0)`, `state: held|debited|released`, timestamps. Zero-cost pilot jobs still record policy outcome. |
| `credit_ledger` | `id`, `user_id FK`, `job_id? FK`, `operation_key UNIQUE`, `kind: pilot_grant|legacy_import|reserve|debit|release`, `amount INTEGER CHECK(amount>=0)`, `created_at`, `audit_ref?`. Append-only; reserve/release changes availability, debit changes balance. |
| `mutation_receipts` | `id`, `actor_scope`, `operation`, `idempotency_key`, `request_hash`, `response_json`, `created_at`, `expires_at`; UNIQUE(actor_scope,operation,idempotency_key). Handles create-project, revision, share creation/finalization; redact tokens from receipts or encrypt recoverable one-time responses under a documented key. Prefer share retry behavior described in API contract. |
| `audit_events` | `id`, `project_id?`, `actor_type: user|reviewer|system`, `actor_id?`, `operation`, `record_id?`, `revision_id?`, `request_id`, `metadata_json`, `created_at`. Whitelisted redacted fields only; never body values, raw prompts, PINs, URL credentials or sensitive free-text. |
| `cleanup_tasks` | `id`, `project_id FK`, `target_type: r2_object|provider_file|project_metadata`, `target_ref` (private), `state: pending|running|completed|retry_wait|blocked`, `attempt_count`, `next_attempt_at?`, `last_error_code?`, timestamps; UNIQUE(target_type,target_ref). Purge order respects accounting/audit retention policy. |

### Minimum indexes

- projects `(owner_user_id,status,updated_at,id)`; revisions `(project_id,revision_number)` unique.
- assets `(project_id,state)`; jobs `(project_id,created_at,id)`, `(state,updated_at)` and owner/key unique.
- briefs `(project_id,brief_number)` unique; shares `(brief_id,revoked_at,expires_at)` plus token hash unique.
- review actions `(brief_id,created_at,id)`; sessions `(grant_id)`; cleanup `(state,next_attempt_at)`.
- foreign-key indexes for user/consent lookups; no unindexed full-table scans on normal dashboard/job polling paths.

## Input snapshot shape

```ts
type ProjectInput = {
  schemaVersion: 1;
  overview: { title: string; occasion: string | null; deadline: string | null;
    timezone: string; fit: 'regular' | 'relaxed' | 'fitted'; notes: string };
  template: { id: string; version: number } | null;
  fabric: { sourceAssetId: string | null; selection: null | {
    method: 'sam' | 'manual_crop'; sourceAssetId: string;
    cropAssetId: string; maskAssetId: string | null;
    regionId: string | null; analysisJobId: string | null };
    widthMm: number | null; lengthMm: number | null;
    enteredWidth: { value: string; unit: 'mm'|'cm'|'in'|'yd' } | null;
    enteredLength: { value: string; unit: 'mm'|'cm'|'in'|'yd' } | null;
    directionality: 'yes'|'no'|'unknown'; stretch: 'yes'|'no'|'unknown';
    shrinkage: 'preshrunk'|'not_preshrunk'|'unknown';
    confirmedObservations: { key: string; value: string; origin: 'user'|'spark' }[] };
  design: { optionIds: Record<string,string>; personAssetId: string | null };
  measurements: { name: string; kind: 'body'|'garment'; valueMm: number | null;
    enteredValue: string | null; enteredUnit: 'mm'|'cm'|'in';
    source: 'customer_manual'|'tailor_manual'|'experimental_photo_estimate';
    sourceAssetId: string | null; recordedAt: string | null }[];
  selectedConceptAssetId: string | null;
  customerQuestions: string[];
};
```

The server owns timestamps/provenance claims; client `recordedAt` is not authority for audit time. Incomplete draft accepts nulls; job/finalize validators enforce action-specific completeness. Template-derived option IDs are allowlisted. Notes max 2,000 characters; title 1–100; question max 500 each/10 total. Limit complete JSON request bodies to 64 KiB excluding upload bytes.

## State and version semantics

1. Draft saves use `expectedDraftVersion`; compare-and-swap and increment on success. Unsaved text is visibly marked. No autosaved browser measurements/photos.
2. Freeze draft creates immutable input revision using expected draft/project versions and atomically advances project pointer. Identical input hash may reuse the current revision; never modify it.
3. Jobs refer only to frozen input. Analysis output returns observations/candidates; user selection updates draft, then freezes again before concept generation. Concept selection similarly updates draft before brief assembly.
4. Brief assembly creates immutable content in `draft` state. Owner can finalize with outstanding questions, but must acknowledge blockers; the view is labelled incomplete. Acceptance requires no unresolved blockers. Sharing before finalization is forbidden.
5. Finalizing a new brief supersedes the previous one and revokes its active review grants transactionally. `latest_brief_id` points to the latest finalized brief, not an in-progress assembly; unfinalized brief results are found through assembly jobs/history. Old owner history remains readable. Unfinalized draft changes alone do not silently revoke an already shared brief; UI says which version is still shared.
6. Review state is derived from append-only actions on one brief: `awaiting_review`, `changes_requested`, `design_approved`, `accepted`. A change request invalidates acceptance and requires a new finalized brief before further approval. Measurements verified is a separate count, never a synonym for design approved.
7. Production brief acceptance requires design approval, all required measurements explicitly verified for the same brief, a fabric result of `sufficient` OR a **new tailor-entered reviewed estimate resolving unknown**, and no unresolved required question. P0 can omit the estimate override UI; in that case unknown blocks acceptance but not design approval. `insufficient` always blocks acceptance until changed inputs/new brief.
8. Project list `reviewStatus` is derived for latest finalized brief, not stored as an independently editable project status. Archiving is reversible; deleting is not an archive.

## Accounting atomicity requirement

Agent A must choose and test a concrete D1 SQL strategy, not assume batch rollback on zero-row updates. Recommended baseline: migration-defined triggers on reservation insert/terminal transition enforce conditional balance changes and use `RAISE(ABORT,...)` when no account update succeeded. A transactional batch creates job + reservation + unique ledger rows; insufficient balance aborts all. Only `held→debited` or `held→released` is legal, with terminal replay a no-op returning the existing outcome. Test trigger behavior in actual D1; if unsupported, stop and agree an equally atomic alternative before enabling charges.

All prices/allowances are server config; client never chooses cost. Pilot grants are documented server seed operations, not an endpoint. Historical Supabase wallets remain separate until reconciled, verified-account cutover is approved.

## Migration sequencing

1. Apply numbered new-slice migrations to development D1; create no production resources from a coding agent without authorization.
2. Seed approved template data separately from structural migrations. A safe demo template without a reviewed numerical rule returns unknown; do not fabricate reviewer names/signatures.
3. Test empty DB → latest and previous version → latest; check FK violations, indexes, deterministic conversions and reservation constraints.
4. Provision local users on verified Clerk requests, independent of webhook timing. Verify webhook signatures if lifecycle synchronization is implemented.
5. Historical import/account claiming is a separate owner-approved operation with dry-run counts, protected exports, legacy-ID uniqueness and wallet reconciliation. No email-only linking, password-transfer promise or destructive source changes.
