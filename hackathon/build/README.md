# Fashley Tailor — agent build pack

**Version:** 1.0 · **Planning baseline:** [approved PRD v1.1](../Fashley-Tailor-PRD.md).  
**Status:** Implementation specifications and runnable task prompts only. Nothing in this pack claims that infrastructure, models, rules, templates or tests have been validated in deployment.

## Start here

This pack replaces the prototype/demo experience as the design target for the **new tailoring product**. It does not authorize deleting the existing outfit/shoe/bag studios, changing live payment behavior, migrating live accounts, or destroying user data. The new primary experience is a tailoring workspace, not a marketplace or a demo page.

| Document | Read for |
| --- | --- |
| [01 — Web structure](01-web-structure.md) | Routes, navigation, folder boundaries, scope and user journeys |
| [02 — Data model](02-data-model.md) | D1 tables, fields, constraints, revisions and state machines |
| [03 — API contracts](03-api-contracts.md) | Exact endpoint inventory, DTOs, errors and concurrency behavior |
| [04 — Frontend specification](04-frontend-spec.md) | Every page, form, action, shadcn/ui composition and interaction state |
| [05 — Backend and AI](05-backend-ai.md) | Clerk, Workers, R2, Workflows, Meta adapters, accounting and privacy |
| [06 — Acceptance and integration](06-acceptance.md) | End-to-end gates, fixtures, test ownership and release evidence |
| [Agent A — Backend/database](tasks/backend-database.md) | Copy-ready GLM task prompt and ordered work checklist |
| [Agent B — Frontend](tasks/frontend.md) | Copy-ready GLM task prompt and ordered work checklist |
| [Agent C — Orchestrator](tasks/orchestrator.md) | Copy-ready GLM coordination prompt, dependencies and shared-file ownership |

## Three-agent execution

1. Start **Agent C** first. It inspects the repository, freezes shared Zod/TypeScript contracts and creates safe fixtures. It does not create a multi-agent runtime inside the product.
2. After contract gate G0, start **Agent A** and **Agent B** in parallel. A implements live services; B implements against the same contracts with test-only adapters until services are available.
3. C owns integration files and staged end-to-end verification. A and B send boundary-change requests to C rather than independently modifying shared files.
4. C switches the frontend from fixtures to real endpoints, verifies model usage and records release evidence. No production fallback to fake model results.

The user intends to select a **GLM model** when launching these sessions. Prompts are model-independent; no exact GLM variant or identifier is assumed and no sessions have been launched by writing this pack. Resolve the actual available model at launch if needed.

## Authority and change control

- Product intent/privacy constraints: approved PRD. Detailed implementation contracts: this pack.
- This pack refines the PRD's proposed four-route sketch into explicit pages and endpoints; it does not expand P0 into a marketplace, payments rewrite or pattern-generation system.
- Conflicts with repository `AGENTS.md` or safety instructions must be surfaced, not silently overridden.
- C owns changes to contracts and this pack. A/B propose schema changes with downstream effects; C updates schemas, fixtures, API docs and consumers together before adoption.
- No destructive git operations, source-user deletion, live account linking, purchases, deployment or push without applicable owner authorization. No claim of eligibility until actual event rules are obtained.

## P0 and cuts

P0 is the complete path: Clerk sign-in → project → sanitized fabric → SAM/manual selection → confirmed intake → real image preview → manual measurements → honest constraints → frozen brief → limited review link → real human review.

One reviewed garment template, one still-image concept, one owner, one review link and browser print-to-PDF are enough. No team switcher, customer CRM, public feed, tailor directory, admin CMS, notifications center, shopping cart or subscription purchase is needed. Account settings contains only useful controls, not fictional settings.

**Sensitive runtime dependencies:** person-photo upload stays disabled until a Worker-compatible sanitizer and consent handling pass; published fabric rules stay absent until a real tailor reviews them. New-project flows must still work without person photographs and must return `unknown` when fabric estimation lacks a validated rule.

## Initial implementation gates

| Gate | Required artifact |
| --- | --- |
| G0 | Shared runtime schemas, endpoint DTOs, consistent fixtures, file ownership acknowledged |
| G1 | Staging Clerk session + D1 round trip + private R2 + durable smoke job; model access recorded |
| G2 | Persisted project intake, upload validation, immutable revision and real segmentation/manual fallback |
| G3 | Real concept, source-labelled measurements, deterministic constraints or honest unknown |
| G4 | Frozen brief, restricted share, human actions, stale/revoked/expired cases |
| G5 | Cross-user, concurrency, privacy, refresh/retry and accessibility tests; evidence and handoff |

G1 blocks claims of deployability, not independent UI work against explicit fixtures. G5 blocks release, not iterative local development.

## Research and environmental notes

- Existing React 19, TanStack Start/Router, React Query, React Hook Form, Zod 3, Tailwind 4 and local shadcn/ui wrappers are present. Clerk is not yet an installed dependency in the inspected package file.
- Current shadcn/ui documentation was retrieved through Context7 `/shadcn-ui/ui`: component-selection patterns, sidebar composition and accessible form validation. Sources: https://ui.shadcn.com/docs/components and https://ui.shadcn.com/docs/forms .
- Existing wrappers use the repository's established Radix/Form API. Newer documentation also shows other primitives and `Field` components; do **not** copy those APIs blindly or regenerate every wrapper.
- Project technical/library implementation must fetch current docs via Context7 as required by global instructions. Prior PRD research does not remove implementation-time compatibility gates.
- Memory MCP tools were not exposed in this session; this pack is the persistent handoff. The supplied workspace does not expose Git history; do not invent a baseline commit.
