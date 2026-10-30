# Agent A — Backend and database task sheet

**Role:** Implement the new tailoring backend, D1 schema, private media and durable Meta jobs.  
**Model:** User-selected GLM at session launch; no exact variant assumed.  
**Start:** After C publishes G0 shared contracts. Safe infrastructure investigation may begin earlier without editing C-owned files.

## Copy-ready session prompt

> You are Agent A, backend/database implementer for Fashley Tailor. Read repository/global AGENTS.md and `hackathon/build/README.md`, then `01-web-structure.md`, `02-data-model.md`, `03-api-contracts.md`, `05-backend-ai.md`, `06-acceptance.md` and this task sheet. The approved PRD is `hackathon/Fashley-Tailor-PRD.md`. Implement only the backend-owned slice using Cloudflare Workers, native D1, private R2, Workflows, Clerk-verified internal user IDs and actual Meta adapters. Coordinate with Agent C before shared contract/config/dependency edits. Do not invent provider syntax, real template rules, credentials or successful test results. Fetch current library/API docs via Context7 under the repository's instructions. Do not deploy/push, migrate live accounts, enable purchases or delete user data without authorization. Do not spawn further agents unless explicitly authorized. Implement incrementally with tests; report blockers early and finish using the acceptance document's handoff format.

## Read before coding

- Inspect current `src/start.ts`, `vite.config.ts`, `package.json`, API route conventions and existing auth/coin/image services. Reuse patterns where correct; never call the old provider Meta by renaming a model string.
- Obtain G0 schemas from C. Ask for missing contracts rather than defining a local fork.
- Confirm D1/R2/Workflow/Clerk/Meta credentials are available **without printing them**. Missing secrets are blockers to live proof, not permission to ship a fake result.

## Exclusive ownership

Own `migrations/tailor/`, `src/lib/tailor/server/`, new `/api/tailor` HTTP handlers, backend tests and a companion workflow Worker directory if agreed. Request C edits to dependencies/lockfile/start/root/Vite/deployment/PWA/shared schema files. Do not edit frontend routes/components.

## Ordered work checklist

### A0 — Feasibility and boundary agreement

- [ ] Record actual runtime/build integration needs and share with C.
- [ ] Resolve current official documentation and actual Meta access/operations for proposed models.
- [ ] Prove supported sanitizer/crop pipeline; capability=false for person photos until verified.
- [ ] Propose exact D1 accounting trigger/batch strategy and race-test it; no zero-row rollback assumption.

**Handoff:** G1 evidence/blockers, exact requested configuration/dependency edits, sanitizer decision and safe limitations.

### A1 — Schema, repositories and identity

- [ ] Implement numbered SQLite migrations, indexes/checks/FKs and migration tests.
- [ ] Implement stable Clerk-subject mapping and concurrent idempotent local-user creation.
- [ ] Implement project/revision/asset/job authorization helpers and consistent safe error envelope.
- [ ] Implement template read repository; separate reviewed seed from fixture data.
- [ ] Implement `/me`, preferences and purpose-scoped consent/withdrawal services.

**Done when:** two synthetic users cannot cross access boundaries; no passwords/email-only legacy claiming; schemas match C contracts.

### A2 — Projects and uploads

- [ ] Project list/create/read, versioned draft save/freeze, history, archive and tombstone deletion.
- [ ] Keyed mutation receipts where required; stale writes return conflict, not silent merge.
- [ ] Authenticated upload intent/PUT/complete/status and durable sanitizer, quarantine cleanup.
- [ ] Private owner asset reads and durable SAM/manual crop lineage.
- [ ] Consent withdrawal blocks processing/sharing and schedules relevant derivative cleanup.

**Done when:** G2 passes with persisted reopen/conflict and malicious-upload tests; no quarantine input reaches models.

### A3 — Jobs and Meta composition

- [ ] Credit account/reservation/ledger with one terminal settlement.
- [ ] Stable-ID durable dispatch, step checkpoints, cancellation, bounded retry and ambiguity handling.
- [ ] Real SAM/Spark analysis output, explicit candidate regions and uncertain observations.
- [ ] Real Muse Image request/response translator and durable concept storage.
- [ ] Server-validated frozen-input prompts and output schemas.
- [ ] Job status/cancel/retry endpoints and server cost quotes; no client pricing.
- [ ] Actually scheduled dispatch/reservation/cleanup reconciler with safe tests.

**Done when:** G3 provider/storage/accounting checks pass; duplicate work cannot duplicate user debit; failure modes honest.

### A4 — Constraints, brief and review

- [ ] Deterministic required-field checks and reviewed rule evaluation with unknown fallback.
- [ ] Bounded Wonder tools and immutable brief assembly, no arbitrary tool execution or unsupported quantities.
- [ ] Finalization/supersession transaction, current/history reads and exact brief asset set.
- [ ] Share grant/token hashing/PIN throttling/session exchange and allowlisted reviewer DTO.
- [ ] Restricted media/action endpoints, exact-version design approval, per-value attestation and guarded acceptance.
- [ ] Atomic races tested against revoke/supersede/delete and repeated actions.

**Done when:** G4 passes; no measurement leakage in excluded shares; approvals never transfer to a new brief.

### A5 — Handoff and negative tests

- [ ] Test every endpoint's owner/reviewer/unauthenticated/invalid-resource behavior.
- [ ] Run 10-way duplicate/credit races and adverse provider/scheduling/cleanup cases.
- [ ] Supply sanitized fixtures/actual response examples to B/C without changing frozen schemas unilaterally.
- [ ] Document actual model usage, limits, upstream costs if supplied and unverified retention/API capabilities.
- [ ] List any unimplemented cleanup/retention/historical migration path explicitly.

## Not your scope

No marketplace, payments rewrite, production SQL formula invented from model output, automatic photo circumference, public bucket, arbitrary image fetch, custom auth/password system or agent framework. Legacy identity/data import is gated separate work; preserve source systems.

## Boundary-change request

Send C: requirement → existing contract limitation → proposed schema/endpoint change → migrations/security implications → affected frontend/tests → whether current work can continue. Do not unblock yourself by returning undocumented fields or changing status enums locally.
