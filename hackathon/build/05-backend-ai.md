# 05 — Backend, identity, media and AI execution

## Service boundaries

HTTP handler → shared schema validation → verified actor → authorization → domain service → native D1 repository / private R2 / Workflow dispatcher. Handlers remain thin. Services accept internal user/reviewer context, never a trusted client `ownerId`. Prompts remain server-only and versioned.

Suggested services: `identity`, `projects`, `revisions`, `uploads`, `selection`, `templates`, `constraints`, `jobs`, `briefs`, `shares`, `reviews`, `credits`, `cleanup`. These are modules, not separately deployed microservices. Use a companion Workflow Worker only if the existing build cannot expose a Workflow class safely.

## Infrastructure and configuration

| Binding/config | Purpose | Exposure |
| --- | --- | --- |
| `DB` | D1 metadata | Server only |
| `TAILOR_MEDIA` | Private R2 sanitized media and quarantine prefixes | Server only |
| `TAILOR_WORKFLOW` | Durable AI execution binding | Server only |
| `MEDIA_WORKFLOW` | Durable sanitation/cleanup if needed, or shared workflow with explicit job type | Server only |
| `MODEL_API_KEY` | Meta credential | Secret |
| Clerk backend key, webhook signing secret if enabled | Session/lifecycle verification | Secrets |
| Clerk publishable key | Clerk browser UI | Public configuration only |
| approved origin list, policy version, feature flags, job budget/quote limits | Server-authoritative behavior | Send only safe capabilities to browser |

Names are proposed bindings, not CLI syntax. C validates actual framework/runtime entrypoints and owns final deployment config. Use separate environments and no checked-in secrets. Do not replace the Lovable wrapper with a second competing Vite integration without an observed need.

## Clerk and authorization

1. C integrates current compatible Clerk middleware/provider with existing `src/start.ts`, preserving explicit CSRF/error middleware and legacy isolation.
2. A maps verified Clerk subject to `app_users` id with unique identity insert. Concurrent first requests converge on the same user. Never trust email matching or a submitted legacy UUID.
3. All owner services scope project, revision, job, asset and brief through active owner + non-deleted project. Asset/revision IDs must belong to the same project as the action.
4. Review authorization checks session hash, grant expiry/revocation, non-superseded brief, permitted action/asset/data and project tombstone each time. Use primary-consistent reads; replicas cannot delay revocation.
5. Verified Clerk identity and link-possession identity remain distinct. Optional authenticated tailor identity is later scope, not inferred from the owner being signed in in the same browser.
6. Global Supabase function middleware stays for legacy endpoints until explicit migration. Clerk-only new routes must not accept an old Supabase session as equivalent. C prevents global legacy hooks/cart sync from polluting restricted review routes.

## Media pipeline

```text
purpose consent → upload intent → authenticated bounded PUT into quarantine
→ complete → durable decode/validate/orient/strip metadata/re-encode
→ store sanitized asset → remove quarantine object → ready
```

- JPEG/PNG/WebP only; maximum 10 MiB encoded and 20 megapixels decoded. Verify magic bytes and successful decode; reject oversized dimensions/decompression bombs, animation/unsupported content and corrupt files. Filename/MIME alone is not validation.
- Test chosen sanitation technology on deployed Workers. No assumption that native Node image libraries work. Person photos disabled until all checks pass. Fabric upload also requires a safe decoded pipeline; if unavailable G1 fails rather than sending quarantine data upstream.
- Original means the sanitized, orientation-corrected source, not the raw EXIF-bearing upload. Limit temporary raw quarantine retention and include failed uploads in cleanup.
- Selection creates a durable crop from the actual original/mask region; validating coordinates is not a crop implementation. Persist parent lineage and valid same-project ownership.
- Provider accepts only trusted sanitized references delivered through a documented secure method. Prefer uploaded provider file IDs/data input where supported; if a signed provider URL is necessary, make it short-lived, object-scoped, no broader grant and redacted from logs. Never accept arbitrary remote image URLs from customers.
- Download provider results immediately via allowlisted documented hosts, with response size/type limits and decoded validation; persist to R2. Expiring output URLs are not saved designs.
- Sensitive assets and private SSR/API never enter PWA caches, Cache API, IndexedDB or localStorage. Private browser in-memory query state clears at sign-out/session switch.

## Model adapters and actual access gates

| Adapter | Intended model | Output validation |
| --- | --- | --- |
| `segmentFabric` | `sam-3.1` | Actual region/mask artifacts + normalized bounding boxes tied to original |
| `understandFabric` | `muse-spark-1.3` | Bounded observations with uncertainty; no invented composition/yardage |
| `generateConcept` | `muse-image-1.0` | Persisted image + exact frozen input + actual model/request provenance |
| `assembleBrief` | `muse-wonder-1.0` | Schema-valid brief with every numerical assertion grounded |

Meta base URL intended by approved research: `https://api.meta.ai/v1`. A fetches current official docs and verifies account access for each ID and operation. Never assume OpenAI-compatible request/event formats, mask editing support, provider idempotency, file deletion, streaming or paid access. A working legacy OpenAI image response is not a successful Meta integration. If model access fails, record the blocker and ask for an eligible alternative; do not silently substitute models or use fixture output in production.

## Durable jobs

Separate job types prevent generating an image whenever a brief changes:

| Job type | Steps | Required frozen facts |
| --- | --- | --- |
| `analyze_fabric` | Validate → SAM → Spark → persist observations/candidates | Sanitized fabric source + processing consent |
| `generate_concept` | Validate → build prompt → Muse Image → validate/persist concept | Published template, valid options, actual selected fabric crop, optional consented person reference |
| `assemble_brief` | Validate → deterministic checks → bounded Wonder tools → validate/persist brief | Template/version, selected concept, selected fabric, source-labelled measurement entries (may be incomplete with blockers) |

State: `queued → running → completed`; `running → retry_wait → running`, `running → needs_attention`, `running → failed`, `queued/running/retry_wait/needs_attention → cancelled`. `stage` carries factual work label; do not fabricate percent completion. Missing required concept facts should reject scheduling before reservation; missing production facts may appear as brief blockers.

### Scheduling and replay

1. Normalize request + hash, validate consent/ownership/inputs and compute server quote.
2. Atomically create unique job, hold reservation, write audit/ledger. Idempotent duplicate returns original job; changed payload conflicts.
3. Dispatch Workflow with stable job ID. A failed dispatcher does not lose the durable DB job. Reconciler retries dispatch by stable ID; create conflicts are resolved by checking existing instance.
4. Steps persist provider IDs and output artifact IDs and reuse completed artifacts. Workflow state contains IDs/small JSON only, not megabytes of base64.
5. A successful provider response must become durable before a job publishes. Compare current consent/tombstone/cancel state at publication; deleted or withdrawn content must not reappear.
6. Debit once only on successful application result under configured policy; release once on permanent failure/cancel. Record upstream provider costs separately. User debit can remain once even if an explicitly authorized provider retry incurs another upstream cost.
7. Cancellation is best effort upstream, authoritative for future app access/publication. It does not promise provider refund or immediate provider deletion.
8. Scheduled reconciliation covers undispatched jobs, stale reservations, stuck jobs, cleanup, expired sessions/grants/rate-limit buckets. C must actually configure execution; an uncalled helper is not a reconciler.

Initial retry policy: at most three transient attempts per safe step with exponential backoff/jitter within a 10-minute job deadline; validate against actual platform/provider limits. Invalid input/auth failures are permanent. A timeout after provider submission is `needs_attention` unless saved provider identifiers permit safe retrieval; no blind duplicate paid inference. Explicit retry carries cost acknowledgement where required. Retry in place is allowed only before deadline while reservation remains held. Once permanently failed/cancelled/deadline-expired, release the reservation and require an explicit new keyed job for another attempt; never reopen a terminal reservation or debit it twice.

### Agent tool scope

Wonder may call only `get_project_revision`, `get_garment_template`, `check_required_measurements`, `calculate_fabric_requirement`, `check_brief_consistency`, already pinned to one server-authorized revision. Maximum six tool calls, one bounded schema repair and configured token/cost ceiling. No arbitrary SQL, network, shell, messaging, credit or share tools. Treat notes and model-extracted text as untrusted data. Persist concise tool facts/results, not hidden reasoning.

## Constraints and review integrity

- Versioned reviewed rules are deterministic server code/data with explicit domain. Unknown cloth dimensions/properties or unsupported template inputs yield `unknown`, never invented fabric quantity.
- No production formula is supplied by this pack. Obtain actual tailor-approved rules + fixtures; until then display “Tailor estimate required.” A model's confidence is not a reviewed rule.
- Circumferences are manual measurements; photo estimates do not become verified. Body dimensions, garment dimensions and ease are different schema concepts.
- One transaction checks latest finalized brief + content hash + grant scope + action prerequisites before appending review action. It must race safely with finalization, revoke, deletion and another action.
- `request_changes` closes approval eligibility for that brief; customer creates/finalizes new version. Prior actions remain visible but do not transfer.
- `accept_brief` requires separate prior design approval and exact required measurement attestations, resolved required questions and sufficient reviewed fabric conditions. It never means “ready to cut.”

## Sharing and retention

- High-entropy token stored as hash, optional securely hashed PIN, short review cookie, expiry default 24h. Redact token route from application/edge telemetry; minimal entry page with no third-party assets or analytics. C verifies hosting logs/referrer behavior, not just client console logging.
- New grant preview enumerates measurements/assets/actions and export risks. Measurements excluded by default; enabling verification/accept requires explicit inclusion. Original person source excluded by default.
- Grants/review sessions are revoked on owner action, project delete, relevant consent withdrawal and newer brief finalization. Every authorized media response checks current grant, not just session creation time.
- Show actual configured retention. PRD proposes person-source deletion after seven days; implement derivative/provider cleanup and choose legally reviewed retention before live intake. Never promise provider zero retention.
- Project deletion atomically tombstones/revokes, then durable cleanup removes R2 originals/crops/masks/concepts and supported provider files. Track retry/blocked cleanup honestly. Backup/provider exceptions and already exported copies are disclosed.

## Observability and handoff

Request/correlation IDs connect HTTP, workflow, ledger and audit. Log IDs, statuses, timings, usage, provider IDs and safe failure classes only. No prompts containing body data, measurement values, raw media, notes, secrets, review URLs or PINs. Readiness results must distinguish real provider integration, fixture tests, actual deployment and remaining blockers.
