# Agent C — Orchestration and integration task sheet

**Role:** Coordinate backend/frontend implementation, own shared contracts/config and verify the complete product. This is a development role, not a multi-agent feature to add to Fashley.  
**Model:** User-selected GLM at session launch.  
**Start:** First. Release A/B's parallel implementation after G0.

## Copy-ready session prompt

> You are Agent C, orchestrator/integrator for Fashley Tailor. Read repository/global AGENTS.md, the approved PRD and every document in `hackathon/build/`, including the A/B task sheets. Establish shared Zod/TypeScript contracts, test fixtures and strict file ownership, then coordinate Agent A (backend/database) and Agent B (frontend) against those contracts. The user intends three GLM-backed sessions; use only the explicitly chosen available model if you are authorized to launch them, and do not spawn an unlimited agent tree. If A/B are launched manually, provide the prompts and coordinate their handoffs instead. Own shared config/dependencies/root/auth/PWA/contracts/integration tests and release evidence. Do not replace the existing framework stack blindly, discard user work, invent test/provider results, migrate live users, enable purchases, deploy or push without authorization. Fetch current framework/SDK/API docs via Context7 under the repository instructions. Preserve old studios while making the new tailoring product the primary new experience. Complete the gates in `06-acceptance.md` and provide an evidence-based handoff with remaining blockers.

## Ownership

Own `src/lib/tailor/contracts/`, fixtures, shared change log, integration tests, top-level root/home/auth/recovery/shared-header/footer edits, `src/start.ts`, `package.json`/lockfile, Vite/deployment/PWA config and route generation. A owns backend/server/SQL; B owns new presentation/client routes. Ask before touching their active files, or integrate their supplied patch after explicit handoff.

## Launch order and dependencies

```text
C: inspect baseline → schemas/fixtures + ownership agreement (G0)
                         ├─ A: infra + D1 + API + AI + review
                         └─ B: shell + pages + interactions + review UI
C: Clerk/config/PWA integration ───────────────┘
                     G1 → G2 → G3 → G4 → G5
```

G1 can progress alongside fixture-backed UI. Do not block B waiting for every model. Do not let fixture completion become a live-completion claim. A's actual endpoint integration follows the shared schemas rather than requiring B to reverse-engineer ad hoc JSON.

## Ordered checklist

### C0 — Baseline and G0

- [ ] Read all instructions/current changes; identify whether repository history/worktrees are actually available. Do not initialize/delete/recreate history or run destructive commands to force the plan.
- [ ] Record current build/test/lint baseline and runtime constraints without logging secrets.
- [ ] Translate data/API spec into browser-safe shared Zod 3 schemas and inferred types. Make redacted reviewer DTO separate and allowlisted.
- [ ] Create fixtures F01–F16 and a test/development adapter entrypoint. Production adapter is live-only and fails closed if unavailable.
- [ ] Create `hackathon/build/IMPLEMENTATION-STATUS.md`: gate rows, owner, dependency, evidence, blockers, shared contract changelog.
- [ ] Share exact owned path list and G0 schema location with A/B; collect acknowledgements.

**G0 release artifact:** contracts parse fixtures, test suite has schema checks, prompts/path ownership ready. Then A/B can implement in parallel.

### C1 — Shared infrastructure integration

- [ ] Fetch current Clerk/TanStack/Cloudflare docs before exact configuration changes.
- [ ] Validate existing Lovable/Nitro build entrypoint and Workflow support. Use companion Worker only if needed; do not duplicate plugins.
- [ ] Apply A's dependency/binding requests centrally; keep package/lock consistent.
- [ ] Integrate Clerk provider/middleware, approved origins and API CSRF protection while preserving legacy Supabase isolation/error handling.
- [ ] Integrate B's public home/auth/recovery components and root/owner navigation once, not duplicate route trees/providers/footers.
- [ ] Restrict global cart/auth/telemetry hooks on review entry/session routes; protect private SSR and error reporting.
- [ ] PWA: explicit network-only bypass for private owner/account/review/API/media paths and safe removal of previous sensitive route caches; preserve dev/iframe/preview guards and root registration ownership.
- [ ] Configure CSP/referrer/no-store/log redaction for restricted review routes; audit edge analytics/logging and external font/assets.
- [ ] With authorization, prove G1 staging session/storage/durable-job/model checks; otherwise record unperformed live checks as blockers.

### C2 — Contract integration by slice

- [ ] Integrate Projects + Drafts first; verify real refresh and conflict before generating images.
- [ ] Integrate uploads/selection; verify actual sanitation + lineage before sending media upstream.
- [ ] Integrate concept/measurements/checks; match all job/result/error fields against shared schemas.
- [ ] Integrate brief finalization/share/review actions; validate omitted data is absent from network JSON and rendered page.
- [ ] For any requested contract change: record reason/security/migration impact, update schemas/docs/fixtures/tests, notify both agents, then integrate callers/handlers together.
- [ ] Remove test adapter reachability from production bundling/selection; no success fallback when backend fails.

### C3 — Adversarial scenarios and evidence

- [ ] Execute every G2–G5 test in `06-acceptance.md` with A/B evidence and independent end-to-end checks.
- [ ] Confirm accounting atomicity under actual D1 behavior, stale approval races and primary-consistent revocation.
- [ ] Verify full flow on another browser/phone for reviewer, including no-person-photo path and no account requirement.
- [ ] Obtain real reviewed template/rule and human collaborators through owner; otherwise retain honest unknown/gated acceptance.
- [ ] Run build/lint/test/type checks, browser QA and print checks; distinguish pre-existing failures.
- [ ] For browser actions follow global `agent-browser` instructions; actual DevTools diagnostics use the mandated diagnostics tool. Never publish sensitive screenshots.
- [ ] Prepare build disclosure, actual model-use manifest and measured evaluation report. No made-up dates, impact metrics or verified eligibility.

### C4 — Owner handoff

- [ ] Explain what works live, what is fixture-only, what is blocked and what was not tested.
- [ ] Provide changed paths, actual test/deployment results, required secrets/config names (not values) and migration/release risks.
- [ ] Ask separately for any live migration/production deployment/push/payment authorization; do not treat coding authorization as permission for all operations.
- [ ] Leave legacy account/payment source intact; record next safe increment.

## Coordination protocol

Use bounded updates at: G0 completion, infrastructure blocker, each integrated vertical slice, contract change and final handoff. Avoid continuous noisy status chatter.

Each update: **completed → evidence → next dependency → blocker/owner question**. A/B handoffs use the standard format in `06-acceptance.md`. Resolve shared-file contention centrally, not by overwriting the other agent's work or running repository-wide formatting. Keep a minimal integration fix scoped; do not rewrite modules just because an agent preferred different names.

## Escalate instead of guessing

- Actual event rules/model eligibility inaccessible.
- Meta model unavailable or documentation differs from prior research.
- Worker-compatible sanitization/cropping or workflow export unavailable.
- Credit reservation cannot be proven atomic.
- No real tailor-reviewed rule or adult/asset consent.
- Existing Clerk import/account linking or live payment data requires cutover.
- Deadline/budget forces scope change: preserve complete honest handoff; cut variants/video/photo estimates/extra templates first.
