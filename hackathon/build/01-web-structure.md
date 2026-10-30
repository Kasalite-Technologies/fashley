# 01 — Web structure and implementation boundaries

## Product architecture

```text
Public site                       Clerk session
/                                 /auth
/about /contact /privacy /terms     /account
            ↓                          ↓
                  /tailor (projects)
                      ↓
                 /tailor/new
                      ↓
       /tailor/projects/$projectId?step=...
      fabric → design → measurements → brief
                      ↓
       /tailor/projects/$projectId/brief
                      ↓
       /tailor/projects/$projectId/history
                      ↓ share confirmation
 /review/$token → token exchange → /review (restricted session)
                      ↓
       design approval / change request / verification
```

Owner routes use Clerk and application ownership. Review routes use a separately scoped review session, not the owner's Clerk session. A tailor need not create an account for P0; the UI must disclose possession-based identity.

## Route inventory

| Route | Access | Exact responsibility | Priority |
| --- | --- | --- | --- |
| `/` | Public | Real product landing page with consented illustrative sample; start/resume CTA | P0 |
| `/auth?mode=sign-in\|sign-up&redirect=...` | Public | Clerk sign-in/sign-up; allowlisted same-origin return path | P0 |
| `/reset-password` | Public | Clerk recovery entry/compatibility route; never mix Supabase recovery tokens with Clerk | P0 |
| `/tailor` | Owner | Project dashboard with search, status filter, cursor pagination and new project CTA | P0 |
| `/tailor/new` | Owner | Project identity and published-template selection; creates draft and routes to fabric step | P0 |
| `/tailor/projects/$projectId` | Owner | Six-step workspace controlled by validated `step` query parameter | P0 |
| `/tailor/projects/$projectId/brief?briefId=...` | Owner | Current or explicitly selected frozen brief, review state and sharing | P0 |
| `/tailor/projects/$projectId/history` | Owner | Immutable input/brief versions, review actions and job outcomes | P0 |
| `/review/$token` | Possession credential | Minimal token-entry page; no private content until explicit exchange; suppress referrers/logging | P0 |
| `/review` | Restricted session | Review granted brief, permitted media, attestations and actions | P0 |
| `/account` | Owner | Clerk profile/security entry, unit preference, consent list/withdrawal | P0 |
| `/about`, `/contact` | Public | Actual purpose and working contact links; retain valid content | P0 polish |
| `/privacy`, `/terms` | Public | Accurate AI/media/sharing/retention disclosures; no invented legal guarantees | P0 |
| `/studio`, `/shoe-design`, `/bag-design`, `/wardrobe`, `/coins`, `/shop`, `/discover`, `/product/$handle` | Existing access rules | Legacy surfaces, outside new P0; preserve, do not promote as migrated | Compatibility only |

An unauthenticated owner URL redirects to sign-in without leaking title, preview or measurements in HTML/metadata. A missing or unauthorized project returns the same safe not-found view. Static `/tailor/new` must not be mistaken for a dynamic project path.

### Workspace steps

`step=overview|fabric|design|measurements|brief|handoff`; default `overview`. Unknown values normalize to `overview`. These are panels in **one persisted project route**, not six disconnected projects.

- Overview: title, occasion, deadline, template, fit and notes; save to server draft.
- Fabric: original image, SAM selection/manual fallback, physical cloth dimensions and confirmed profile.
- Design: optional person consent/photo, controlled design preferences, generate/select concept.
- Measurements: garment-specific measurements, provenance and rule evaluation.
- Brief: editable **structured input corrections**, compile job and final checks. AI draft editing is done by correcting facts and regenerating, not an unsupported rich-text document editor.
- Handoff: redirect/CTA to frozen brief; grant creation and latest review status. No duplicated brief editor.

Nonlinear navigation is allowed; each paid/irreversible action has explicit server validation. A missing measurement must not prevent saving an intake draft or exploring an illustrative concept. Finalization/acceptance gates remain separate.

## Navigation and layout

- Public shell: logo, How it works anchor, About, Contact, Sign in, Start a brief. Mobile `Sheet` menu. Root footer remains mounted exactly once.
- Owner shell: compact `Sidebar` with Projects, New project, Account; user menu for profile/sign-out. No fake studios/team switching. Breadcrumb + current project title in content header. Mobile collapses into a labelled navigation `Sheet`.
- Project header: editable title in Overview, draft save state, current input version, brief status, History action. Desktop two-column working area; mobile one column with sticky bottom primary action.
- Review shell: small Fashley mark, revision/status, security/privacy notice; no owner sidebar, analytics, cart, third-party media embeds or marketing widgets. Root footer's legal links remain, but external font loading and global hooks must not leak the review URL.
- Printing uses the same brief renderer with a print stylesheet, not a second inconsistent content model.

## Proposed code layout

These are target locations, not claims that files exist. Match established route conventions and generated route-tree tooling after inspecting them.

```text
src/lib/tailor/contracts/       # C: Zod 3 schemas, DTOs, enums, fixtures interface
src/lib/tailor/client/          # B: typed fetch client, query keys, test adapters
src/lib/tailor/server/          # A: identity, repositories, services, grants, rules
src/lib/tailor/server/meta/     # A: per-model request/response adapters
src/components/tailor/         # B: shells, forms, media, brief, review components
src/routes/tailor*              # B: owner UI routes, following router conventions
src/routes/review*              # B: review UI routes
src/routes/api/tailor/          # A: thin HTTP handlers
workers/tailor-workflows/       # A: only if companion Worker is necessary
migrations/tailor/             # A: SQLite SQL migrations and explicit pilot seed
tests/tailor/                  # Each owner adds tests; C owns integrated scenarios
hackathon/build/                # C: shared spec/change log and gate evidence
```

Keep server-only prompts, Clerk secrets, R2 keys, SQL and Meta SDK calls out of browser-safe contracts. Raw SQL migrations with a native D1 repository are the P0 default; do not introduce an ORM migration overhaul. Existing PostgreSQL Drizzle configuration remains untouched unless a separate agreed migration requires it.

## Ownership boundaries

| Files/area | Owner | Rule |
| --- | --- | --- |
| Shared DTOs/schemas and fixtures | C | A/B request changes; never independently fork types |
| API handlers, D1 SQL, server services, workflow/model code | A | B consumes only public contracts |
| New UI routes/components/client hooks and local styles | B | A does not modify presentation to fit ad hoc responses |
| `package.json`, lockfile, `vite.config.ts`, deployment config, `src/start.ts`, root route, shared header/footer, route generation, PWA | C | A/B supply exact requested edits; C integrates |
| Existing auth/recovery routes and top-level homepage | C integration; B supplies components | Avoid duplicate routes or identity providers |
| Evaluation reports, integration tests, release switch | C | A/B supply test results and limitations |

If no Git worktrees are available, use strict file ownership in the shared workspace and do not run repository-wide formatting. If the owner supplies a Git repository, use separate non-destructive branches/worktrees only with an agreed integration process. Do not initialize/recreate repository history as a workaround.
