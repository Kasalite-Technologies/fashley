# Agent B — Frontend task sheet

**Role:** Build the complete new tailoring web experience with local shadcn/ui components.  
**Model:** User-selected GLM at session launch.  
**Start:** After C supplies G0 contracts and fixture adapter boundary. Can work in parallel with A.

## Copy-ready session prompt

> You are Agent B, frontend implementer for Fashley Tailor. Read repository/global AGENTS.md, `hackathon/build/README.md`, `01-web-structure.md`, `03-api-contracts.md`, the complete `04-frontend-spec.md`, `06-acceptance.md` and this task sheet. Build the real tailoring workspace, not the old Lovable demo page. Use existing React/TanStack routing, React Query, React Hook Form/Zod and local shadcn/ui wrappers; inspect actual exports and fetch current library docs via Context7 as required. Consume Agent C's shared contracts, never invent API routes or locally fork DTOs. Own new UI components/routes/client hooks; ask C to integrate root/auth/home/shared navigation/PWA/dependency changes. Use clearly isolated development/test fixtures while Agent A works, never production mock fallback or fake approvals/model results. Preserve existing studios and root footer. No secret/provider/database calls from the browser, sensitive persistence, pushes or live deployments without authorization. Do not spawn further agents unless explicitly authorized. Implement page-by-page with accessibility and interaction tests; finish using the acceptance document's handoff format.

## Exclusive ownership

Own `src/components/tailor/`, `src/lib/tailor/client/`, new `/tailor`, `/review`, `/account` route components and frontend tests. For existing homepage/auth/recovery routes, supply standalone components and exact integration requests to C rather than concurrently editing root/shared files.

Do not modify A's API handlers/server/SQL or C's contracts, lockfile, root, route-tree output or deployment config. Scoped Tailor styles may live alongside owned components; request shared token edits from C.

## Ordered work checklist

### B0 — Inspect and agree client boundary

- [ ] Audit existing local shadcn exports/forms/theme and responsive behavior.
- [ ] Use C's shared schemas and fixture interface. Agree one typed fetch boundary/error handler.
- [ ] Create query keys scoped to actor/resource; no token/PIN keys or query persistence.
- [ ] Confirm expected public/owner/reviewer shells and route file conventions with C.

**Handoff:** UI component inventory, route additions requested and any missing API contract, before implementation drifts.

### B1 — Shells and entry pages

- [ ] Public landing component P01, authentication/recovery presentation P02 for C integration.
- [ ] Owner shell, breadcrumbs/mobile navigation, root footer compatibility.
- [ ] Dashboard P03: filters, real empty state, cards, pagination, archive/delete confirmations.
- [ ] New project P04: published template choices and idempotent create.
- [ ] Account P10: real profile entry/preferences/consent withdrawal/usage only.
- [ ] Shared empty/error/loading/focus/status primitives.

**Done when:** route links resolve with correct session behavior; no dead controls or fictional data.

### B2 — Intake workspace

- [ ] Six-step frame, server-draft restoration, save status, unsaved warning and conflict handling.
- [ ] Overview fields and template-change warning.
- [ ] Fabric consent/upload/status, original/overlay/region selection and accessible manual fallback.
- [ ] Actual physical dimensions/properties and confirmable Spark suggestions.
- [ ] Design preferences/person capability+consent/mannequin default.
- [ ] Save→freeze→keyed-generate sequence, factual job panel, durable reopen and safe retry/cancel.
- [ ] Frozen-snapshot concept viewer/selection and stale-input warning.
- [ ] Measurement forms with explicit unit/source/body-vs-garment semantics and deterministic constraints.

**Done when:** G2/G3 frontend fixtures pass, then repeat against A's live endpoints. No old output relabelled by live controls.

### B3 — Brief and history

- [ ] Structured question/input corrections, compile/finalize and unresolved-blocker acknowledgements.
- [ ] Reusable semantic `BriefDocument`, exact version/current vs historical status.
- [ ] Share dialog: included-data preview, measurements off by default, person image off by default, expiry, optional PIN, purpose consent.
- [ ] Raw link memory-only copy/WhatsApp; replay link-unavailable state; grant list/revoke.
- [ ] Review-summary polling while visible and no implicit jobs on page load.
- [ ] History timeline and explicit historical-input-to-new-draft confirmation.
- [ ] Print-to-PDF styles at A4/letter without token or clipped facts.

### B4 — Restricted tailor review

- [ ] Minimal token entry P08, explicit POST exchange and URL replacement before private fetch.
- [ ] Session-only review P09 with allowlisted content and granted-media URLs.
- [ ] Separate request changes, design approval, measurement attestation and acceptance controls.
- [ ] Server capability gating, exact content hash, idempotent action submission and persisted receipts.
- [ ] Revoked/expired/superseded action clears private state; stale action never applies to new revision.
- [ ] Asserted identity clearly labelled; no verified badge for link/PIN.

### B5 — Interaction and visual verification

- [ ] All listed error/empty/loading/conflict/provider/rate-limit/disabled states exercised.
- [ ] 375/768/1280px, keyboard-only, zoom, focus, screen-reader names, crop non-pointer alternative.
- [ ] No private draft/measurements/body media/review tokens in localStorage/IndexedDB/PWA/query persistence.
- [ ] No UI that says cutting pattern/guaranteed fit/measurement verified merely after approval.
- [ ] Tests and screenshots use synthetic/consented content; label fixture evidence as fixture evidence.

## Integration rules

- Test fixtures can simulate G0 behavior, but working screens are not live-provider proof.
- Do not hardcode a garment catalogue whose options differ from server templates.
- Do not hide missing endpoints behind a toast that falsely says saved/shared/approved.
- Never auto-retry uncertain paid mutations with a fresh key. Never auto-save a conflict over newer server state.
- Supply C with exact shared-file edits and test evidence; report blockers, not unfinished controls disguised as polished UI.
