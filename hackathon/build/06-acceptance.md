# 06 — Acceptance, fixtures and integration gates

Unchecked items below are work, not passed tests. Agent C maintains an evidence log with date, environment, command/test name, outcome and artifact path. Distinguish local unit tests, deployed integration tests and manual human review.

## Fixture contract (C creates; A/B share)

Use synthetic identities and consented/publicly licensed images only. No real customer values, tokens or keys in public source. Test review tokens are clearly synthetic and never production credentials.

| Fixture | Required state and expected UI/backend outcome |
| --- | --- |
| F01 First use | Empty user/project list → create real persisted draft, no paid work |
| F02 Normal path | Published reviewed template, sanitized fabric, manual dimensions, concept, required manual measurements; complete review possible after separate attestations |
| F03 Insufficient cloth | Reviewed rule yields insufficient; correction CTA; acceptance blocked even after design approval |
| F04 Unknown cloth/rule | Missing dimensions or no reviewed numerical rule → unknown; design approval allowed, acceptance blocked without validated resolution |
| F05 Missing measurements | Blank, not zero; brief may carry blockers; acceptance blocked |
| F06 SAM failure | Failure visibly distinct, manual crop/re-upload path; no invented SAM overlay |
| F07 Provider failure | Retryable/permanent failures, no artifact publication, one release; raw provider body hidden |
| F08 Ambiguous timeout | Needs-attention, no blind repeat paid inference, explicit retry acknowledgement |
| F09 Concurrency | Two draft editors; stale save/freeze conflict, no overwrite |
| F10 Restricted share | Measurements and original person source omitted by default and absent from serialized response |
| F11 Revoked/expired | Existing session/media/action denied immediately, sensitive UI cleared |
| F12 Superseded brief | New finalization invalidates old link/action; old owner history remains immutable |
| F13 Two users | User B cannot access A's project, asset, job, revision, brief, upload or share |
| F14 Delete mid-job | Access revoked immediately, late provider result cannot resurrect/publish, cleanup tracked |
| F15 Link identity | Name/PIN never displayed as verified identity; design approval not measurement verification |
| F16 Consent withdrawal | Future AI processing/share denied and affected grants revoked; derivative cleanup tracked |

Mock templates/rule arithmetic are allowed in isolated tests with obvious fixture provenance. A test fixture must not be seeded as a real published production template with an invented reviewer.

## Gate G0 — Contract freeze (C)

- [ ] Shared Zod schemas parse all success/error fixtures; request/response types infer from schemas.
- [ ] ProjectInput, redacted reviewer DTO, job-result discriminators and common error codes exported.
- [ ] Every frontend action maps to one documented endpoint; no guessed backend route.
- [ ] File ownership and shared-change request protocol acknowledged by A/B.
- [ ] Existing scripts/build output and baseline failures recorded before changes.

## Gate G1 — Infrastructure and provider proof (A + C)

- [ ] Actual build deploys to authorized staging Workers; no conflicting Vite/TanStack plugin stack.
- [ ] Clerk login/session/recovery paths verified with actual installed SDK; Origin/CSRF negative tests pass.
- [ ] Stable local-user provisioning survives concurrent first requests and delayed webhooks.
- [ ] D1 migrations/constraints/triggers tested in target environment; private R2 fixture round trip proven.
- [ ] Durable smoke job completes after browser disconnect/reopen.
- [ ] Sanitizer runs with decoded limit/metadata stripping/crop capability, not just MIME checks.
- [ ] Each claimed Meta model/operation has a real successful access test with safe provenance. Unavailable models explicitly blocked, never claimed as working.
- [ ] Service worker bypass covers owner routes, account, review token/session pages, API/media; old sensitive caches removed safely without deleting unrelated user data.

UI work can continue against labelled fixtures while G1 is blocked; release cannot.

## Gate G2 — Intake and immutable inputs (A + B)

- [ ] Project create, draft save, refresh restore and optimistic conflict tested.
- [ ] Invalid extension/MIME/magic bytes, corrupt, >10 MiB and >20MP images rejected server-side.
- [ ] Person upload impossible without enabled capability and separate active consent.
- [ ] Actual SAM overlay tied to original; multiple regions require explicit selection; manual alternative labelled manual.
- [ ] Physical dimensions are entered, not inferred; unit conversion round-trip tested.
- [ ] Freeze creates immutable snapshot; job cannot use another project's assets/revision.

## Gate G3 — Generation and safety (A + B)

- [ ] Real Meta concept persisted privately with frozen inputs/model/prompt version/provider ID when available.
- [ ] Editing controls during generation does not relabel result.
- [ ] Reopen/duplicate request resumes same job; completed unrelated steps reused.
- [ ] Measurement sources and body/garment distinction survive persistence and rendering.
- [ ] Missing/unknown/insufficient facts detected deterministically; no estimate becomes verified.
- [ ] Wonder tool loop confined to authorized revision, bounded calls/repair/cost and schema-validated output.
- [ ] Unsupported numerical claims/questions are rejected or marked unknown, not quietly promoted to facts.

## Gate G4 — Handoff and review (A + B + C)

- [ ] Brief finalization freezes content and revokes older grants atomically.
- [ ] Share preview accurately matches actual redacted payload and permitted assets/actions.
- [ ] Token exchange requires explicit POST, applies PIN throttling and removes token before private fetch.
- [ ] No credentials in referrers, application/edge error logs, third-party analytics, HTML metadata, print or browser persistence.
- [ ] Grant expiry/revoke/supersede/deletion denies existing session assets and actions immediately.
- [ ] Design approval, measurement attestations and acceptance separate; exact same-brief prerequisites enforced server-side.
- [ ] Request-changes requires new brief for approval; stale content hash returns conflict.
- [ ] WhatsApp action opens encoded message only; backend never sends.
- [ ] Browser print/PDF includes exact revision/disclaimer, readable at A4/letter.

## Gate G5 — Release evidence (C)

- [ ] All ownership paths tested with two users and review-only credential.
- [ ] Parallel duplicate generation (at least 10 requests), same-key/different-body, repeated finalizer and insufficient-credit races yield one job/reservation/terminal settlement.
- [ ] Reserve-vs-debit/release trigger/batch rollback tested when conditional account update affects zero rows.
- [ ] Race tests: accept vs supersede, action vs revoke, publication vs delete/withdraw, repeated consent withdrawal and cleanup retries.
- [ ] Cancel, provider ambiguity, scheduling failure and stale-reservation reconciler tested; reconciler actually scheduled.
- [ ] Test suite, typecheck, lint, production build run; baseline failures distinguished from new ones. Do not invent a typecheck script if absent; use an agreed explicit compiler command after inspecting tsconfig.
- [ ] Keyboard-only + 375/768/1280px + zoom + dialog/focus + crop alternative + print checks documented.
- [ ] No dead buttons, fixture-mode production fallback, fake testimonials or unverified completion claims.
- [ ] Legacy outfit/shoe/bag/auth/legal/PWA smoke checks; no silent live data/payment cutover.
- [ ] `hackathon/BUILD-DISCLOSURE.md`, model-use manifest, evaluation report and remaining-blockers list created with real evidence.
- [ ] Owner approval obtained before live account migration, production deployment/push or purchases.

## Human evaluation

Use the PRD targets, not invented outcomes: two practicing tailors; at least 12 authorized fabric examples; six consenting end-to-end scenarios; known insufficient/missing/provider-failure/unauthorized cases. Report successes and safe failures separately, sample sizes, timings, corrections and limitations. Without real reviewed rules or human collaborators, label the result a technical prototype and leave production acceptance gated.

## Required handoff format (every agent)

```text
Completed:
Files changed:
Contract changes requested/applied:
Tests actually run + results:
Deployment/provider checks actually performed:
Blocked/not implemented:
Security/privacy concerns:
Next dependency/owner decision:
```

Never use “done” to hide mock behavior, unavailable credentials, skipped integration tests or deferred cleanup.
