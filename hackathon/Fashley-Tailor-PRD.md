# Fashley Tailor: Product Requirements Document

**Version:** 1.1 · **Prepared:** 30 October 2026  
**Status:** Cloudflare D1 database and Clerk authentication approved by the owner; authenticated event rules require confirmation. This is a specification, not a completed migration.  
**Target:** Meta Global AI Developer Hackathon, Startup track, Build for Your World theme.  
**Submission deadline:** 4 November 2026, 9:00 PM US Eastern / 5 November, 2:00 AM Accra. Reconfirm in the participant portal.  
**Product promise:** Turn a customer's fabric and outfit idea into a visual design and a tailor-reviewed production brief, without losing the measurements, constraints or decisions along the way.

> Build the shortest credible path from fabric to a real tailor's approval. Do not spend the remaining hackathon window building a fashion marketplace or claiming automatic precision tailoring from photographs.

**Detailed build handoff:** See [the agent build pack](build/README.md) for proposed page-by-page shadcn/ui specifications, D1 fields/invariants, application API contracts, backend execution, acceptance gates and separate backend/frontend/orchestrator task sheets. It refines this PRD's route/API outlines; writing the pack does not mean implementation has started or deployment has been verified.

## 1. Executive decision

Fashley should compete as **an AI-assisted tailoring workflow**, not another fashion image generator.

The existing Lovable prototype already turns fabric photographs into outfit, shoe and bag concepts. The hackathon increment will close the missing operational loop:

1. Capture the customer's actual fabric and available dimensions.
2. Use Meta segmentation to isolate the selected cloth and, optionally, the customer.
3. Generate a garment concept referencing the real fabric and optionally the customer's photograph.
4. Collect source-labelled measurements and detect missing production information.
5. Check a narrow, tailor-approved garment template against available fabric and design constraints.
6. Assemble a versioned tailor brief with measurements, reference images, assumptions, materials and unresolved questions.
7. Share a restricted review link through WhatsApp; the tailor requests a change or approves a specific brief version.

**The memorable demo:** A customer wants a design that the available fabric cannot support under a reviewed template. Fashley flags the conflict instead of inventing a reassuring answer. The customer selects a simpler design, the brief updates, and a real tailor reviews and approves it on another phone.

That is a testable product outcome: **a reviewed handoff**, not just an attractive image.

There is no guaranteed winning idea. This strategy improves the entry's credibility through domain specificity, useful model composition, measurable outcomes and a complete live workflow.

## 2. Evidence, rules and unresolved assumptions

### 2.1 What research establishes

| Item | Evidence status | Planning consequence |
| --- | --- | --- |
| Event runs 26 October–4 November; judging 4–8 November; closing 9 November | Organizer event material and indexed official pages [S1–S3] | Plan from 30 October, not a fresh ten-day build |
| Startup track emphasizes technical execution and production readiness | Official public event material [S1–S3] | Show authorization, recovery, provenance and an actual customer workflow |
| Build for Your World is an event theme | Official public event material [S1–S3] | Lead with Ghanaian tailoring workflows and real collaborators |
| Muse Spark, Muse Wonder, Muse Image and SAM 3.1 are available model families | Official model documentation retrieved through Context7 and indexed official pages [S4–S7] | Use the specific models in Section 8, subject to account access tests |
| Cloudflare Workers supports TanStack Start and R2 bindings; Workflows supports durable steps | Current Cloudflare documentation retrieved through Context7 [S8–S10] | Host app/API on Workers, private media on R2, long jobs in Workflows |
| Impact 30%, creative model use 25%, demo 25%, technical depth 20% | Supplied PDF only; not independently verified | Useful provisional prioritization, not a statement of confirmed rules |
| Public GitHub repository and three-minute demo video | Submission-form fields subsequently supplied by the user | Prepare both artifacts; confirm any additional format/access rules |
| One submission, top-five finals, exact prize amounts, exclusions and pre-event-code disclosure policy | Supplied PDF; authenticated rules not retrieved | Verify before eligibility or submission decisions |

The `/details` and `/discord` links return a login screen. Direct retrieval of Meta documentation returns a regional/identity interstitial in this environment; Context7 and indexed official documentation provided the model details. The waiver page did not expose its full rules through direct retrieval. **This document does not claim to have read authenticated content.**

The public event page advertises several Meta model options. It does **not** establish that every submission must use all four, that SAM is mandatory, or that Muse Code usage alone qualifies a project. Verify the actual minimum model requirement with organizers.

### 2.2 Required owner confirmations

| ID | Question / action | Deadline | If unresolved |
| --- | --- | --- | --- |
| D1 | Resolved: owner selected Cloudflare D1; confirm plan and region requirements during deployment | Before production provisioning | Vendor decision is settled; do not reopen Turso selection without a new requirement |
| D2 | Confirm team members' acceptance, Startup-track eligibility and team-size rules | 30 October | Do not assume an existing app automatically qualifies |
| D3 | Obtain actual Official Rules, including pre-existing-code policy, submission requirements, model minimums and judging rubric | 30 October | Treat compliance as unresolved; feature development is not evidence of eligibility |
| D4 | Verify access from the team's actual accounts and region to the four proposed model IDs | 30 October | Use only eligible, organizer-confirmed alternatives; narrow scope if required |
| D5 | Resolved: owner selected Clerk; approve the existing-user account-linking/import and cutover procedure before moving live accounts | Before identity migration | Clerk is the target; no destructive changes to existing Supabase identities |
| D6 | Recruit at least two practicing tailors and consenting adult demo participants | 30–31 October | Present a technical prototype, not a validated tailoring product |
| D7 | Confirm available engineering capacity and operating budget | 30 October | Default to the reduced scope in Section 5.3 |

**Approved stack decision:** After clarifying that “TESODB” meant Turso, the owner selected **Cloudflare D1** and **Clerk**. Target architecture is Workers + D1 + R2 + Workflows + Clerk + Meta Model API. D1 schema/migrations must use SQLite-compatible semantics; existing PostgreSQL RPCs and RLS require an explicit replacement. Supabase is the existing source system, not the target authentication provider or application database.

**D1 versus Turso:** D1 offers a native Workers binding, transactional batches and built-in Time Travel recovery. It fits this metadata-heavy workflow while photos and generated images stay in R2. It is not unlimited-write infrastructure or a replacement for PostgreSQL stored procedures. Batch rollback on SQL errors does not mean an update affecting zero rows automatically aborts the batch: credit reservations must enforce success through SQL predicates/constraints and concurrency tests. Use primary-consistent authorization/revocation reads or correctly managed Sessions when read replicas are involved. Current documented database-size limits are 500 MB on Free and 10 GB on Paid; Time Travel retention is seven and thirty days respectively [S19].

Turso is a valid alternative when database portability across hosting providers or its specific replication capabilities are important. Its documented libSQL interface supports remote HTTP access, atomic batches and interactive write transactions; those transactions lock writes until completion and have a documented five-second timeout [S20]. Neither option should hold a database transaction open during AI inference. Migrating from Supabase/PostgreSQL to either option still requires rewriting RPC/authorization behavior and reconciling data.

### 2.4 Submission form confirmed by the user

The supplied form requests: track, problem statement, project description, public GitHub repository, three-minute demo video, use of Meta products, why Meta models are important, partner-technology feedback, likelihood of using Meta Model API and overall opinion of the API. It also offers an X-post field for Most Viral consideration and grants organizers permission to publish/promote submitted materials.

**This is a submission checklist, not a judging rubric.** It supplies no numerical weights. The PDF's 30/25/25/20 percentages remain unverified. Select Startup and the exact dropdown option corresponding to Build for Your World if available; the user has not supplied the dropdown choices. Do not assume Most Viral is mutually exclusive with Startup merely because the form calls it a track—confirm those rules.

Answer the two Meta questions separately: describe the actual implementation/model roles in the first; explain why segmentation, grounded intake, reference-based visualization and tool-assisted brief review matter to the user outcome in the second. Include only models actually integrated. Partner feedback and API sentiment must reflect genuine usage; use “not used” where appropriate rather than inventing experience. Public-promotion permission reinforces the need for separate demo consent and sanitized submission assets.

### 2.3 Submission hygiene

- Inventory everything present before the event and everything implemented during it. Record dates honestly, using existing history if available; never fabricate a baseline commit or event timestamps.
- The supplied workspace does not expose Git history. Obtain the connected repository history before making claims about when features were built.
- Request written organizer clarification if the rules' treatment of an existing Lovable app is ambiguous.
- Prepare `hackathon/BUILD-DISCLOSURE.md`, a model-usage manifest and evaluation report during implementation. They are deliverables, not files claimed to exist today.
- Public source and video must exclude credentials, customer media, body measurements, private logs and real payment data.
- Confirm rights to fabrics, templates, photographs, code and demonstration assets. Borrow patterns from winning projects, not their proprietary implementation.

## 3. Winning precedents and what to borrow

These are relevant precedents, not proof that a tailoring product will win. No Reddit sources were used.

| Project | Verified result / source | Pattern relevant to Fashley | What not to infer |
| --- | --- | --- | --- |
| Wrench Board | Silver in Built with Opus 4.7; organizer announcement and project repository [S11, S13] | A specialist's workbench combines visual evidence, domain tools and human judgment; show the decision on the object being worked on | Its current repository contains post-event development; do not attribute every current feature to the hackathon version |
| MaestrIA | “Keep Thinking” prize; official ClaudeDevs announcement [S12] | Move from a photograph through validated practical constraints to an actionable tradesperson handoff; keep outreach human-approved | A prize does not validate automatic garment measurement or cutting accuracy |
| OpenGlass | First place at Meta's first Llama 3 hackathon; official Meta recap [S14] | Make the model's interaction with the physical world obvious and demonstrate a working capability quickly | That event was a San Francisco hackathon, not evidence that every cited winner was a global competition |

**Fashley's original contribution:** preserve a customer's real fabric and preferences across visualization, measurement review, fabric-constraint checking and tailor approval, with evidence and version history. The defensible asset becomes validated local garment templates and real tailor feedback, not generic prompts or a multi-agent diagram.

## 4. Users, problem and commercial hypothesis

### 4.1 Initial customer

**Primary buyer:** Independent tailor or small fashion studio in Ghana managing custom occasion wear through photographs, voice notes and WhatsApp.

**Primary end user:** Customer who already owns or plans to purchase fabric and needs to communicate an outfit clearly.

**Secondary user:** Studio assistant handling intake and follow-up questions.

Initial language is English. Local garment terminology must be reviewed by participating tailors. Twi/Ga voice input and translation are later work, not an untested hackathon promise.

### 4.2 Problem hypotheses to validate

- A reference picture rarely specifies all measurements, fabric requirements or construction choices.
- An attractive generated image can suggest an outfit that cannot be produced from the available cloth.
- Decisions change in chat without a clear final version.
- Tailors repeatedly ask for missing information and cannot tell which measurements were checked.

Do not present these as quantified market facts yet. Interview collaborators and collect permission to quote their actual experience.

### 4.3 Jobs to be done

- Customer: “Show me a credible concept using my fabric and tell me what my tailor still needs.”
- Tailor: “Give me one reviewable brief instead of disconnected messages and unverified numbers.”
- Studio owner: “Reduce clarification effort without delegating professional judgment to an image model.”

### 4.4 Business model hypothesis

Start B2B: a studio workspace with a monthly allowance of completed briefs and optional additional usage. Test willingness to pay with real tailors before fixing a subscription price. Existing customer coins may fund previews, but do not make an unproven coin economy the pitch.

During the hackathon, avoid rebuilding Paystack or opening real purchases. Existing purchase enablement is already pending webhook and real-payment verification in `roadmap.md`.

**Evidence package:** two tailor interviews, a small timed intake comparison, one genuine reviewed brief, and explicit consent for any testimonial. Report sample size and limitations. Do not claim proven reductions in waste, returns or remakes without actual production follow-up.

## 5. Scope and priority

### 5.1 P0: submission-critical vertical slice

1. Workers-hosted app/API, private R2 storage and one durable end-to-end AI job.
2. Authenticated tailoring project with immutable revisions.
3. Fabric upload, SAM segmentation overlay and user selection/correction by crop or re-upload.
4. A deliberately limited style catalogue: target two tailor-reviewed garment templates; ship one if needed.
5. Muse Image preview using fabric reference and optional consenting adult customer photograph.
6. Structured manual measurements, required-field checks and source labels.
7. Deterministic fabric requirement check **only for reviewed templates with known inputs**; otherwise “tailor estimate required.”
8. Muse Spark extraction and Muse Wonder brief assembly/consistency review with bounded, read-only domain tools.
9. Versioned responsive tailor brief, print-to-PDF view, revocable review link and WhatsApp share action.
10. Tailor change-request/approval, evidence timeline and visible distinction between design approval and measurement verification.
11. Cost/credit idempotency, safe failure states, owner authorization and a small evaluation report.

D1 and Clerk integration belong in P0. New tailoring projects must use Clerk identity and D1 metadata, with R2 media. A temporary Supabase-backed pilot is a separately disclosed contingency requiring owner approval, **not** completion of the requested migration.

### 5.2 P1: only after the full slice works

- Short fabric video with SAM tracking, if it measurably improves cloth selection under occlusion or motion.
- Experimental photo-derived **visible linear estimates**, with capture-quality rules and manual review. No production dependency.
- Second preview angle, richer side-by-side comparisons and a second garment template.
- Structured labor/trim quote from tailor-entered prices.
- Measurement-aware patterned-fabric allowances if validated by a tailor.

### 5.3 Explicit cuts

If behind schedule: cut video, photo measurement, extra garment templates, second image variants and advanced quotes, in that order. Preserve the complete handoff and honest constraints.

For a solo builder, ship one template, manual measurements, still-image segmentation, one preview and one review action. Prioritize the approved Clerk/D1 integration for the new slice; defer historical-data cutover and payment rewrites rather than rushing all migrations together.

### 5.4 Out of scope

- Full e-commerce marketplace, public social feed and tailor discovery/ranking.
- New shoe/bag production workflows; existing studios remain functional but are not this submission's differentiator.
- Arbitrary garment pattern generation, industrial nesting, automatic sewing instructions or machine-ready cutting files.
- Guaranteed fit, exact cloth reproduction, cloth material-property inference from pixels, or accurate 3D body reconstruction from one photo.
- Autonomous WhatsApp sending, purchasing, charging, scheduling or ordering materials.
- New payment-provider integration, automatic body-shape labels, minors' body photographs, or public body galleries.

## 6. Product experience and information architecture

### 6.1 Proposed routes

| Route | Purpose |
| --- | --- |
| `/tailor` | Value proposition, recent projects, start project |
| `/tailor/projects/$projectId` | Guided intake and version history |
| `/tailor/projects/$projectId/brief` | Owner's current brief and review status |
| `/review/$token` | Restricted tailor review, with expiry and optional PIN |

These routes are proposed, not existing. Keep outfit/shoe/bag routes on the existing shared Studio; reuse its upload, preview and preferences primitives where appropriate rather than introducing incompatible parallel behavior. Mount the existing root footer and keep legal/contact navigation intact.

### 6.2 Main flow

**A. Create project**

Select garment template, occasion, fit preference and deadline. Explain that previews are illustrations and tailoring requires professional verification. Store client preferences, never client-authored system prompts.

**B. Capture fabric**

Upload one clear photograph with the cloth laid flat. Enter usable fabric width and length, units, directionality, and known stretch/shrinkage information or “unknown.” Photographing a swatch does not establish available yardage. SAM highlights detected cloth; the user selects the intended region. If segmentation fails, offer manual crop/re-upload with an explicit “manual selection” label.

**C. Optional person reference**

Ask permission separately for person-image processing. Allow a neutral mannequin preview with no person upload. Use clothed adult photographs only. Do not require a body photograph for project completion.

**D. Design**

Show one concept initially, original swatch beside it, and the actual preference snapshot used. The user checks whether colors/motifs look credible. A reference image is not a physical textile simulation; neither model scoring nor a nice render guarantees pattern scale or drape.

**E. Measurements and feasibility**

Show a garment-specific measurement form, metric/imperial entry with explicit conversion, and a source badge for each value. Ask for missing fields. A reviewed rule checks fabric only when its required dimensions and template conditions are known. Show the assumptions and any incompatibility visibly.

**F. Brief review**

Assemble an editable draft: selected concept, swatch, measurements, materials, fit preference, template assumptions, questions and approval requirements. Customer confirms what may be shared. Finalize a numbered immutable revision.

**G. Tailor handoff**

Generate a limited review link and prefilled WhatsApp message. The customer explicitly presses send in WhatsApp. The tailor sees only the selected brief and permitted assets, then requests a change or approves that revision. “Measurement verified” is a separate attestation with its own actor/time, not a consequence of clicking “design approved.”

**H. Resolve and close**

A change creates a new revision; prior approvals do not transfer. The tailor verifies required measurements and accepts the production brief. The app never labels a document “ready to cut” or claims the app has manufactured anything.

### 6.3 Interaction states and accessibility

- Intake: empty, draft restored, missing fields, incompatible template, upload rejected.
- AI: queued, step in progress, waiting for provider, retryable failure, permanent failure, completed, cancelled.
- Review: draft, ready for review, changes requested, approved, superseded, expired, revoked.
- Keep progress labels factual: “Generating concept” rather than fabricated percentages.
- Refresh/reopen must restore job and project state without repeating paid work.
- Mobile-first at 375px; large touch targets, keyboard access, named form fields and readable measurement tables.
- Statuses use text/icons, not color alone. Keep an original-image view and an overlay toggle.
- Limited connectivity: preserve non-sensitive draft fields; never cache body media, measurements or review pages in the service worker.

## 7. Functional requirements and acceptance criteria

| ID | Requirement | Acceptance test |
| --- | --- | --- |
| FR01 | Project ownership | Another signed-in user cannot read, mutate, generate for or share the project through any endpoint |
| FR02 | Validated uploads | Allowlist JPEG/PNG/WebP, default max 10 MB and 20 megapixels; reject spoofed/unsupported input, handle orientation, strip metadata before external processing, reject corrupt images |
| FR03 | Private assets | Media has no anonymous bucket access; knowing an asset key or project ID is insufficient to retrieve it |
| FR04 | Segmentation selection | Display a real SAM-produced overlay on the original; multiple cloth regions require selection; failed SAM never appears as a successful mask |
| FR05 | Immutable generation input | Editing controls while a job runs cannot relabel its output; displayed/saved metadata uses the job's frozen snapshot |
| FR06 | Meta-generated concept | At least one successful real `muse-image-1.0` result is persisted with model, input revision and provider request ID when supplied |
| FR07 | Measurement provenance | Every measurement has name, unit, source, entered/estimated time and verification status; missing numbers remain missing, never zero/default guesses |
| FR08 | Safe measurement gates | Photo estimates cannot satisfy production verification; unknown or unverified required values block “production brief accepted” |
| FR09 | Fabric constraints | Approved-template fixtures produce reproducible calculations; unknown width/length/template produces an explicit unknown result, not an invented yardage |
| FR10 | Bounded agent execution | Schema-valid outputs only; tools cannot access other projects or send messages/payments; configured step/token/cost limits stop runaway execution |
| FR11 | Versioned brief | Includes source-labelled measurements, selected assets, assumptions and unresolved questions; a changed input requires a new brief revision |
| FR12 | Human-controlled sharing | No message is sent by the backend; the user sees included data before creating the link and can revoke it |
| FR13 | Restricted reviewer | Review credential accesses only the granted immutable revision; expiration/revocation and PIN throttling are enforced on the server |
| FR14 | Approval integrity | Approval records revision and reviewer authentication method; stale revision approval returns conflict; anonymous display name is never labelled verified identity |
| FR15 | Durable work | Closing the browser mid-generation does not lose the job; reconnect resumes by job ID; duplicate POSTs return the existing job |
| FR16 | Accounting | Concurrent duplicate requests settle at most one debit; permanent failures release reservations once; retry cannot credit the wallet twice |
| FR17 | Deletion | Owner deletion first revokes access, then tracks media/provider-file cleanup and bounded backup expiry; pending jobs cannot republish deleted content |
| FR18 | Print export | Mobile brief has a legible print layout and browser Save as PDF; it includes revision and disclaimer, without promising server-rendered PDF infrastructure |

**Definition of a completed brief:** a persisted, versioned brief with no unresolved required fields, tailor design approval, and a separate verification record for all template-required measurements. This is still not a machine-ready cutting pattern.

## 8. AI design: exact models, responsibilities and limitations

### 8.1 Model manifest

| Component | Model ID | Role | Demonstrable output |
| --- | --- | --- | --- |
| Visual segmentation | `sam-3.1` | Find cloth/person regions in stills; optional tracking for P1 video | Boxes/masks and overlay tied to original asset |
| Intake understanding | `muse-spark-1.3` | Describe observable fabric features, normalize customer preferences, flag missing input using structured output | Draft fabric profile with observation/uncertainty labels |
| Garment visualization | `muse-image-1.0` | Compose selected garment, fabric reference and optional person image | Illustrative preview, explicitly not a fit or cloth-physics guarantee |
| Brief agent | `muse-wonder-1.0` | Use project facts and approved rules to assemble a brief and identify inconsistencies | Structured brief, grounded questions and bounded tool trace |

Meta Model API base URL: `https://api.meta.ai/v1`; server-side bearer credential: `MODEL_API_KEY`. SAM uses `POST /v1/responses`, with Files API available for reusable media. Muse Image supports generation/editing endpoints and multi-turn Responses workflows [S4–S7].

Muse Wonder Full is not the same API model: documentation identifies it as a Muse Code subscription capability. Do not specify it as an application endpoint.

Use Standard mode for sensitive workflows; do not select Contributor variants or enable data-sharing modes for customer photographs. Independently confirm current provider retention, training, region and deletion terms before admitting non-demo customer data. Standard mode is not a promise of zero retention.

### 8.2 Meaningful model composition

```text
Private validated fabric/person assets
  -> SAM masks -> user-selected region -> selected crop/mask reference
  -> Spark observations -> schema validation -> user-confirmed fabric profile
  -> frozen garment preferences + reference assets -> Muse Image concept
  -> confirmed measurements + reviewed template rules + selected concept
  -> Wonder tool loop -> validated brief -> customer review -> tailor review
```

SAM should improve cloth selection and provide visible evidence. A mask is **not** a body skeleton, depth map, sewing pattern or tape measurement. Do not claim exact pixel preservation merely because a mask exists.

The documented Muse Image edit interface accepts a JSON `images` array containing reference URLs/data URLs/file IDs. Existing Lovable code uses multipart form data and provider-specific streaming events; it cannot be migrated safely by replacing only the model string. Build and test a Meta-specific request/response translator. Do not assume an editing mask parameter or partial-image streaming is supported without verifying it against the account's API.

Use selected fabric crops and optional person references through documented inputs. If explicit mask-conditioned editing is unavailable, use masks for selection/cropping and disclose that the render remains generative. Persist returned images immediately; provider URLs can expire.

### 8.3 Brief-agent tools and boundaries

One bounded agent is sufficient. Do not create a multi-agent framework for presentation value.

| Tool | Behavior |
| --- | --- |
| `get_project_revision` | Reads only the authorized frozen revision supplied by the server |
| `get_garment_template` | Returns versioned, tailor-reviewed required fields and constraints |
| `check_required_measurements` | Deterministically returns missing/unverified fields |
| `calculate_fabric_requirement` | Executes reviewed template rules; returns result or `unknown` with reasons |
| `check_brief_consistency` | Checks structured inputs and brief for invalid units, unsupported numbers and unresolved blockers |

The agent returns a draft; application code validates and persists it. It has no general SQL, arbitrary URL fetch, shell, wallet, share-link or message-sending tool. User notes and extracted text are untrusted data, not executable instructions. There is no open-ended web shopping in P0.

Initial cap: six tool calls and a configured output-token ceiling per brief attempt. On schema failure, allow one bounded repair; then show a recoverable failure. These are implementation limits, not model capability claims.

Every generated statement involving a measurement, price or fabric quantity must reference structured input or a deterministic result. Unsupported values are omitted or labelled unknown. Preserve useful tool inputs/results, not hidden chain-of-thought.

### 8.4 Measurement truth policy

An A4 sheet establishes scale only under constrained geometry. Different body/card depths, perspective, lens distortion, pose and loose clothing invalidate naive pixel-to-centimeter conversion. A front view does not reveal circumference.

**P0:** manual measurements, with tailor verification. Let the model identify absent fields rather than fabricate them.

**P1 experiment:** controlled front/side capture may suggest selected visible linear dimensions. Use `experimental_photo_estimate` source, capture conditions and empirically measured error ranges if available. Without a validated error study, use “unvalidated estimate,” not an invented 95% confidence score. No inferred bust/waist/hip circumference becomes a verified measurement.

### 8.5 Fabric and production truth policy

- Known width and usable length are user/tailor inputs; a photograph alone cannot supply them.
- Composition, stretch and shrinkage require confirmation; appearance is insufficient.
- Template rules include fit/ease assumptions, fabric width, sizes supported, seam/hem allowances, directionality and repeat allowances where applicable.
- Fabric sufficiency is valid only within a reviewed rule's domain. Outside it, require tailor estimation.
- Distinguish body measurements from garment measurements and ease allowances; never silently substitute one for another.
- Call the output **tailor brief / production preparation brief**, not an automatically valid cut sheet. Machine-ready patterns are later work requiring separate validation.

## 9. Existing implementation and change plan

This is a source inspection, not a new runtime verification. Items checked in `roadmap.md` are historical project claims, not tests rerun for this PRD.

| Existing area | Evidence | Planned treatment |
| --- | --- | --- |
| React 19 / TanStack Start / Vite app | `package.json`, `src/routes/` | Retain the application and routing |
| Lovable Vite wrapper with Nitro default Cloudflare target | `vite.config.ts` | Validate existing build output on Workers before replacing any build system |
| Shared outfit/shoe/bag Studio | `src/components/DesignStudio.tsx`, route files, `AGENTS.md` | Reuse established UI/metadata patterns; do not regress existing routes |
| Image provider uses OpenAI via Lovable | `src/lib/image-gateway.server.ts` | Add tested Meta adapter; not currently Meta-compliant merely because it generates images |
| Accessory suggestion uses OpenAI via Lovable | `src/lib/accessories.functions.ts` | Exclude from hackathon critical path or migrate explicitly; never imply every AI call is Meta while this remains active |
| Server-side prompt assembly | `src/lib/design-prompt.server.ts` | Keep validated preferences and prompts server-side |
| Preference snapshots | `src/lib/design-result.ts` | Extend immutable snapshots to project/brief revisions |
| Supabase identity, data, private storage and RPCs | `src/integrations/supabase/`, Studio, wardrobe, coins functions | Replace with Clerk identity, D1 data and R2 media using an explicit identity/data migration plan |
| Atomic generation reservation/settlement and payment fulfillment | `src/routes/api/edit-image.ts`, `src/lib/paystack.server.ts` | Preserve guarantees; port semantics, not just table names |
| WhatsApp image sharing | `src/components/DesignShareSheet.tsx` | Extend to minimal revocable brief links; existing image links are not tailor approval workflows |
| Drizzle config targets PostgreSQL; schema file intentionally blank | `drizzle.config.ts`, `drizzle/schema.ts` | This does not establish a working alternate database implementation; do not overwrite generated schema blindly |
| Root legal/footer and guarded PWA registration | `AGENTS.md`, `src/lib/pwa-register.ts`, `vite.config.ts` | Preserve preview guards; explicitly exclude private tailoring pages/media from caches |

Existing navigation caching in `vite.config.ts` is broader than the proposed sensitive workflow permits. Before adding tailoring routes, exclude authenticated project/review pages and clear any obsolete sensitive page caches. `Cache-Control: no-store` alone is not sufficient if a service worker explicitly caches the response.

## 10. Target architecture

```text
Mobile browser / desktop
       |
Cloudflare Workers: existing app SSR + static assets + authenticated API
       |-- Clerk: sign-in, sessions and identity lifecycle
       |-- Cloudflare D1: project/revision/job/review/credit metadata
       |-- private R2: sanitized source media, masks, generated results
       |-- Cloudflare Workflows: bounded durable AI steps
                        |-- Meta Model API: SAM, Spark, Image, Wonder

Tailor browser -> restricted review endpoint -> granted brief revision only
```

### 10.1 Responsibilities

- **Workers:** serve application and API, authorize all operations, validate input, issue limited upload/download access, schedule jobs and serve review pages.
- **R2:** private media storage. Separate development/staging/production buckets or enforce equivalent isolation. Public marketing images must not share the private access policy.
- **D1:** authoritative structured records and concurrency controls through a native Worker binding. The frontend never receives privileged database access.
- **Workflows:** persist job progress across steps and retries. Persist object keys/provider IDs, not multi-megabyte image data as workflow state.
- **Meta:** remote inference; no GPU models run inside Workers.
- **Clerk:** authenticate users and validate sessions server-side. Use the official TanStack Start SDK, `@clerk/tanstack-react-start`, after testing compatibility with this project's actual versions and Worker build. Clerk authentication does not replace D1 resource-ownership checks or migrate Supabase RLS automatically.

### Clerk integration and identity migration

- Integrate Clerk middleware into the existing `src/start.ts` without replacing unrelated middleware. Current Clerk documentation calls for explicit TanStack Start CSRF middleware when that start configuration is present; protect API mutations appropriately as well [S21].
- Protect owner endpoints on the server; hiding buttons or wrapping UI with signed-in components is insufficient. Restrict authorized origins to approved deployment domains and keep backend Clerk secrets out of browser bundles.
- Introduce a stable internal application user ID and a unique mapping from `(provider, subject)` to that ID. Clerk subjects are opaque strings, not existing Supabase UUIDs. Store resource ownership using the internal ID so designs, credits and reviews survive a provider change.
- Seed internal IDs from existing ownership records during migration, then attach Clerk identities through a verified import/linking procedure. Never accept an old user ID from the client or auto-link accounts solely because a submitted email matches.
- Choose a supported account-import approach only after checking password-hash compatibility and provider requirements. Otherwise use verified account claiming/re-enrollment. Do not promise existing passwords or Supabase sessions transfer automatically.
- For existing-user pilots, prove old-account control and new Clerk identity before granting legacy designs or balances. Preserve audited mappings; prevent multiple Clerk accounts claiming the same legacy identity.
- Establish the local user record idempotently after a verified sign-in; do not make first access depend on webhook delivery timing. If Clerk webhooks synchronize lifecycle changes, verify signatures and make handling idempotent, replay-safe and tolerant of out-of-order events.
- Test sign-up/sign-in, sign-out, recovery, OAuth callbacks if enabled, expired sessions, two-user isolation and legacy-account access. Clerk-managed recovery replaces Supabase recovery behavior; update route-managed titles, consent and redirects without breaking legal/navigation conventions.
- Historical Supabase sessions and payment records stay isolated until a controlled cutover. Do not accept two unrelated identity namespaces as interchangeable or delete source users during implementation.

Workflows alone is the initial durable mechanism; do not add Queues, Durable Objects, Redis or another orchestrator without a concrete need. Check current plan CPU/memory, execution, payload, concurrency and provider-timeout limits during the deployment spike. Provider waiting time and image transforms are distinct from Worker CPU usage; do not process huge base64 images unnecessarily.

### 10.2 Deployment compatibility gate

The current Lovable configuration already includes TanStack and Nitro plugins. Do not blindly add the Cloudflare Vite plugin or a second TanStack plugin, which could conflict with the wrapper. First validate the generated deployment entrypoint and whether it can expose the required Workflow class/binding. If necessary, use a narrowly scoped companion workflow Worker; preserve same-origin app APIs and keep the orchestration interface internal.

Deployment gate: a staging Worker serves auth, reads/writes a private R2 fixture and completes a durable test job. Only then proceed to production routing. This PRD does not assert that a deployment has happened.

### 10.3 D1 implementation acceptance contract

Before production cutover, confirm:

1. Native D1 Worker binding and SQLite-compatible migrations; no assumption that a long-lived Node process exists.
2. Atomic conditional writes/transactions and unique constraints sufficient for reservations, approvals and idempotency.
3. Supported timestamp/JSON representation, migrations and indexed tenant-scoped reads.
4. Backup/restore, region, retention, access controls and operating cost.
5. A tested concurrency strategy; isolation and retry semantics differ across vendors.

If the implementation cannot meet these guarantees in the available time, seek owner approval for a narrower rollout. Do not remove wallet safety or authorization to meet the deadline.

## 11. Logical data model

Store lengths internally as integer millimeters, preserve entered units for display, money in currency minor units, and timestamps in UTC. Use opaque IDs. Add indexes on ownership/project foreign keys and list/status queries; express enum/check constraints using the confirmed vendor's supported mechanisms.

| Entity | Minimum fields and invariants |
| --- | --- |
| `app_users` | Stable internal user ID, lifecycle status and timestamps; no passwords or provider secrets |
| `auth_identities` | Internal user ID, provider, opaque subject, verified linking/import metadata; unique `(provider, subject)` and guarded legacy-claim mapping |
| `tailor_projects` | `id`, `owner_user_id`, title, status, current revision, created/updated/deleted time, optimistic concurrency version |
| `project_revisions` | `id`, project, revision number, immutable preferences, template/version, fabric dimensions/properties, selected asset IDs; unique `(project, revision_number)` |
| `assets` | `id`, owner, project, private object key, media kind, MIME, bytes, hash, consent reference, retention/delete status; no persisted public URL |
| `measurements` | revision, measurement name, integer value or null, source, original unit, source asset if applicable, verification actor/time; unique name within revision |
| `garment_templates` | `id`, version, supported garment/domain, required measurements, reviewed rule definition, reviewer and review time; published versions immutable |
| `ai_jobs` | owner/project/revision, idempotency key, input hash, state, step, attempt, timestamps, error class, reserved cost; unique owner/idempotency key |
| `ai_step_runs` | job, step key, model/version, prompt version, provider request/job IDs, usage/cost if supplied, artifact IDs, output schema version; unique logical job step |
| `brief_revisions` | project revision, structured brief, selected preview, blockers, provenance, status, created time; frozen when shared |
| `share_grants` | hashed high-entropy token, brief revision, permitted asset IDs/actions, expiry/revoked time, optional PIN hash and attempt counters |
| `review_actions` | brief revision, action, reviewer credential type, asserted name, contact/identity if verified, note, verified measurement IDs, time; append-only audit |
| `consents` | actor, purpose, applicable assets, policy version, time and withdrawal state |
| `credit_ledger` | owner, operation key, reserve/debit/release, amount, job reference; unique settlement keys and transactionally consistent balance |
| `audit_events` | actor, operation, record/revision identifiers, correlation ID, time; redacted metadata, no raw sensitive content |

Do not store account passwords in D1; Clerk owns authentication. Existing wallets/purchases require a separate reconciled migration tied to internal user IDs; no dual source of truth or client-writable balances.

## 12. API contract outline

These are proposed application routes, not Meta endpoint syntax. All owner routes require server-validated identity and ownership. Cookie-authenticated mutations require CSRF/origin protection; bearer endpoints must not accept tokens in URLs.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/tailor/projects` | Create project |
| `GET /api/tailor/projects/:id` | Read authorized project and current revision |
| `POST /api/tailor/projects/:id/revisions` | Create revision with expected current version; stale edit returns `409` |
| `POST /api/tailor/projects/:id/uploads` | Create scoped upload grant with kind, size and MIME constraints |
| `POST /api/tailor/projects/:id/uploads/:uploadId/complete` | Verify stored object and sanitization before accepting asset |
| `POST /api/tailor/projects/:id/jobs` | Start validated job using `Idempotency-Key`; return `202` and job ID |
| `GET /api/tailor/jobs/:id` | Read status/result; polling sufficient for P0 |
| `POST /api/tailor/projects/:id/briefs` | Assemble brief for a frozen revision |
| `POST /api/tailor/briefs/:id/shares` | Create owner-approved restricted review grant |
| `POST /api/tailor/shares/:id/revoke` | Revoke grant |
| `GET /api/tailor/assets/:id` | Authorized media response with no-store headers |
| `POST /api/tailor/reviews/:grantId/actions` | Scoped reviewer action using review session and expected revision |
| `DELETE /api/tailor/projects/:id` | Tombstone, revoke access, enqueue tracked cleanup |

Use one stable error envelope containing `code`, safe `message`, `retryable` and `requestId`. Suggested codes: `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_INPUT`, `REVISION_CONFLICT`, `MISSING_MEASUREMENTS`, `FABRIC_UNKNOWN`, `BUDGET_EXCEEDED`, `PROVIDER_UNAVAILABLE`, `SHARE_EXPIRED`.

Never return raw upstream error bodies containing sensitive input. Hash the request content alongside the idempotency key; reusing a key with different input returns conflict.

## 13. Durable execution, billing and recovery

### 13.1 Job state machine

```text
queued -> validating -> segmenting -> understanding -> generating -> assembling -> completed
             |              |             |              |             |
             +--------------+-------------+--------------+-------------+
                                      -> retry_wait / failed / cancelled
```

Persist terminal state and publish artifacts only after successful validation and durable storage. Some steps can be separate job types; an edited preview should not rerun unrelated completed work.

### 13.2 Correctness guarantees

- Atomically reserve credits and create a unique job record before scheduling.
- Workflow creation uses the stable job ID. A reconciliation task finds records created before scheduling failed and schedules them safely.
- Persist completed step artifacts and reuse them on retries.
- Use provider idempotency/retrieval only where actually supported. A timeout after the provider accepted an image request is ambiguous; do not assume replay is free or exactly once.
- For ambiguous outcomes, reconcile using saved provider IDs if available; otherwise mark for a bounded operator/user-confirmed retry rather than an uncontrolled repeat.
- Ensure one application debit/settlement even if upstream inference was accidentally repeated. Track upstream cost separately from user charging.
- Deletion/cancellation prevents publication; it may not stop an already-running upstream request or refund the provider's charge. Explain that distinction.
- Retry rate limits and transient failures with backoff/jitter and a deadline. Do not retry auth errors, invalid inputs or exhausted budget indefinitely.
- Finalizer and reconciler release stale reservations exactly once. A client disconnect must not determine whether a job succeeded or whether it is charged.

Existing coin RPCs provide atomic protections that must survive migration. Do not claim those Supabase functions will execute unchanged on another database.

## 14. Security, privacy and consent

- Treat body photos and measurements as sensitive personal data; obtain separate consent for processing, tailor sharing and public demo use.
- Demo only with consenting adults; no scraping customer photographs or assuming app consent authorizes a public pitch video.
- Proposed pilot retention: source person images deleted within seven days unless the user elects to keep them; saved briefs/previews retained until deletion. Confirm legal/provider requirements before launch and show the actual policy in product.
- Delete derived crops/masks and provider files where supported, not just the original upload. Maintain tombstones until cleanup completes. Document backup expiry and provider retention exceptions honestly.
- Private R2 bucket, least-privilege credentials, server-owned object paths, tight CORS, sanitized orientation/metadata, byte/pixel limits and decoded image validation.
- Test the image-sanitization implementation in the actual Workers runtime; do not assume Node-native image libraries run there. If no safe sanitizer is available, disable person-image intake rather than uploading unsanitized sensitive images.
- Server fetches only trusted R2 objects and allowlisted provider outputs; never fetch arbitrary URLs supplied through notes or agent arguments.
- Grant creation requires a data preview. Default tailor link expires after 24 hours and is revocable. Exclude the original person photograph by default; include measurements only when specifically selected as necessary for review.
- A bearer review link is possession-based access, not verified tailor identity. Offer a separately communicated PIN for sensitive briefs; use an authenticated tailor account when verified identity is required.
- Exchange the initial URL token for a short-lived secure review session, remove it from the address bar, use `Referrer-Policy: no-referrer`, redact URL tokens from logs and avoid third-party analytics on review pages.
- WhatsApp and anyone receiving a downloaded PDF can retain copies. Revocation stops future app access, not screenshots, downloads or forwarded content. Disable sensitive link previews where possible; do not promise universal control over messaging clients.
- All private responses are `Cache-Control: no-store`; service worker explicitly bypasses them. Public screenshots and marketing assets are separately consented.
- Logs contain IDs, stage timing, usage, result class and provider request IDs; not raw images, prompts with body data, tokens, measurement values or hidden reasoning.
- The model cannot bypass authorization, invoke arbitrary code, modify wallet balances, publish content or approve a brief.

## 15. Evaluation, non-functional targets and evidence

All numerical values below are **proposed acceptance targets**, not measured performance or organizer requirements.

### 15.1 Small evaluation set

- At least 12 authorized fabric photos: plain, patterned, directional, dark, wrinkled and cluttered backgrounds.
- At least six consented end-to-end scenarios, including manual-measurement-only and no-person-photo paths.
- Two practicing tailors reviewing template rules and briefs.
- At least one deliberately insufficient-fabric case, one missing-measurement case, one provider-failure case and one unauthorized-access case.
- Report counts, individual failures and limitations. This sample supports a prototype demonstration, not population-level measurement accuracy.

### 15.2 Acceptance targets

| Dimension | Initial gate / target |
| --- | --- |
| Real model use | Successful authorized account call for every model claimed in the submission |
| Workflow reliability | At least 9 of 10 representative staging runs reach an honest terminal outcome; report successful completions separately from safe failures |
| End-to-end completion | Target at least 8 of 10 representative valid runs producing a reviewable brief without operator intervention |
| Privacy | Zero cross-user reads/writes in automated ownership tests; revoked links immediately denied by server |
| Measurements | All required missing/unverified values detected in fixtures; no photo estimate promoted to verified |
| Fabric constraints | Every reviewed template test reproduces approved expected results; unsupported inputs return unknown |
| Billing | Concurrent duplicates and repeated finalization produce one debit or one release, never both terminal settlements |
| Tailor usefulness | At least 4 of 6 evaluated briefs judged reviewable by participating tailors, with reported remaining corrections |
| API responsiveness | Target p95 under 1 second for metadata endpoints excluding upload/inference, under stated test conditions |
| AI latency | Initial target p50 under 90 seconds and p95 under 180 seconds for preview/brief pipeline; measure and revise after first 10 runs |
| Mobile usability | Complete intake/review at 375px without horizontal overflow; keyboard and labelled controls tested |

Optional segmentation benchmark: hand-annotate a small cloth-mask set and report IoU plus selection usability. Do not claim pixel accuracy from visual inspection alone. Optional photo-measurement evaluation requires paired tape measurements, metric-specific errors and failure rates; it is not required for P0.

### 15.3 Tests required before submission

- Unit: conversions, required measurements, template rules, prompt/schema validation and revision transitions.
- Integration: Meta adapters with recorded redacted fixtures for success/error/malformed output, private asset access and upload completion.
- Concurrency: duplicate job starts, settlement retry, stale review actions and double approval.
- Recovery: close tab, provider 429/5xx, timeout after acceptance, workflow restart, R2 write failure, database failure, deleted-project job completion.
- End-to-end: new project → segmentation → preview → manual measurements → brief → WhatsApp link creation → tailor change → new revision → approval.
- Security: IDOR attempts across every owner endpoint, revoked/expired grant, PIN brute-force throttling, arbitrary URL and prompt-injection attempts.
- Regression: existing Studio, wardrobe, auth/recovery, footer/legal routes, PWA preview guards and coins.

### 15.4 Operational dashboard

Show completed/failed jobs, provider error rate, stage latency, actual model usage, cost per completed brief, stale reservations and pending deletion counts. Alerts initially go to the team through an existing channel; building an alerting platform is out of scope.

## 16. Cost and pricing controls

Do not treat partner promotional credits as guaranteed account balances or assume their open-weight endpoints host every Muse model. Use the team's actual Meta dashboard for prices, entitlements and remaining credits.

```text
Cost per completed brief =
  SAM image/frame charges
  + Spark input/output usage
  + Muse Image outputs
  + Wonder input/output usage
  + allocated failed/retried provider work
  + R2 / Workers / Workflow / database usage
```

Track actual rates with date/currency, usage and request IDs. The PRD intentionally does not fix unverified current per-model prices.

Proposed initial controls: one preview per attempt, maximum two user-requested preview variants before a new explicit quote, bounded agent calls, per-user daily limits, per-job USD-equivalent cap, and a team-wide hard stop. Set numerical spend caps only after checking funded balance and measuring the first ten runs. Keep at least 20% of confirmed inference budget for demo rehearsals and retries.

The user must see a server-generated quote before consuming paid credits. Existing coins are not automatically the right tariff for the new multi-model job; define/reserve its cost server-side and preserve package snapshots. Keep real purchases disabled until independently verified.

## 17. Migration and rollout

### Phase A: preserve the baseline

- Capture source/deployment inventory and obtain actual Git history.
- Document existing app capabilities separately from new event work.
- Make no destructive history changes to the Lovable-connected repository.
- Keep existing live routes and payments unchanged while staging the new workflow.

### Phase B: deployment and model spike

- Deploy the build with Clerk integration to staging Workers and verify sessions, auth callbacks, CSRF/origin protections and CORS for the new origin.
- Add private R2 and durable test-job bindings without duplicating build plugins.
- Test exact Meta model IDs and persist one representative output per modality.
- Configure D1 binding/migrations and verify transactional semantics; resolve image sanitation and workflow entrypoint compatibility.

### Phase C: new tailoring slice

- New project/media/revision APIs use D1 and R2 with Clerk-authenticated ownership.
- Replace direct Supabase storage/data calls only along the new slice first.
- Map verified Clerk identities to internal user IDs and explicitly authorize every D1 query; old Supabase RLS does not follow automatically. Test legacy identity linking before exposing migrated resources.
- Verify full handoff before moving unrelated existing features.

### Phase D: complete existing-data migration after the slice works

- Export with authorized tooling; dry-run mapping preserving owner IDs, asset paths, timestamps and preference snapshots.
- Inventory saved designs, shares, notification data, role records, wallets, purchase snapshots and pending generations.
- Copy private media to R2; reconcile counts and hashes. Maintain a manifest from old paths to new object keys.
- Migrate wallet/payment records in a separately controlled window with balance and transaction reconciliation; no naive dual writes.
- Cut writes over once per domain; retain the old source read-only for an agreed verification period. Rollback must account for writes made after cutover, not simply point traffic back and lose them.
- Keep original assets/data until owner-approved retention and verified migration permit cleanup. No deletion is authorized by this PRD.

**Hackathon constraint:** full historical migration is not a prerequisite to demonstrating new tailoring projects, provided the submission accurately states what still uses Supabase. A “fully migrated” claim requires completed reconciliation and tests.

### Release gates

1. Rules and account entitlements verified.
2. D1 new-write path, Clerk sessions, identity mapping and authorization tested; legacy cutover separately gated.
3. Cross-user authorization and sensitive-cache tests pass.
4. All claimed models run on real input; no silent non-Meta substitution.
5. Tailor validates template and reviews at least one actual brief.
6. Failure/retry/accounting tests pass; no unresolved high-severity privacy defects.
7. Demo rehearsed on staging/production with the same submission build.

## 18. Remaining hackathon schedule

Assumes two engineering contributors plus a founder/domain lead with two available tailors. If capacity is lower, apply Section 5.3 rather than compress testing to zero.

| Date, Accra | Engineering focus | Domain / submission focus | Exit gate |
| --- | --- | --- | --- |
| 30 Oct | Workers/D1/R2/workflow spike, Clerk session test, four model access tests | Retrieve rules, baseline disclosure, recruit tailors, choose one garment template | Real infrastructure/model feasibility known |
| 31 Oct | Projects, private upload/sanitization, SAM overlay, Meta image adapter, frozen revisions | Validate capture instructions and template requirements | Real fabric → persisted Meta preview |
| 1 Nov | Measurement form, deterministic template rule, Wonder brief tools | Review six example briefs/constraints with tailors | Honest brief with missing-data blocks |
| 2 Nov | Restricted review links, WhatsApp handoff, revisions/approval, durable accounting | Timed customer/tailor trials, collect consent and corrections | Second phone completes review loop |
| 3 Nov | Security/recovery/regression fixes, deployment validation | Capture real demo, write evaluation and model manifest | Feature freeze; end-to-end rehearsal passes |
| 4 Nov | Critical fixes only, smoke tests, freeze submission build | Final video, repo disclosure, rules checklist, upload and verify receipt | Submit by internal 11:00 PM Accra target |

Internal submission target leaves three hours before the stated 2:00 AM Accra deadline. Confirm the actual platform cutoff rather than relying on email timezone labels.

If the 31 October gate fails, remove person-photo intake/video/extra templates first. If there is no usable Meta image entitlement, escalate to organizers immediately and do not disguise the legacy provider as a Meta-powered result.

## 19. Demo and submission strategy

### 19.1 Positioning

**One-line pitch:** “Fashley turns your fabric and outfit idea into a tailor-reviewed brief, catching missing measurements and fabric constraints before the handoff.”

Avoid “perfect fit from one photo,” “exact digital twin of your fabric,” “autonomous tailor” and unsubstantiated market-size or savings claims.

### 19.2 Three-minute working script

Three minutes is provisional until rules are confirmed.

| Time | What the judge sees |
| --- | --- |
| 0:00–0:20 | Real consenting tailor/customer and the fragmented intake problem; explain what existed before the event |
| 0:20–0:45 | Upload actual fabric; SAM overlay selects the intended cloth; enter known cloth dimensions |
| 0:45–1:15 | Meta preview with original fabric beside it; identify the model and illustrative limitations |
| 1:15–1:45 | A missing verified measurement or reviewed-template fabric conflict blocks completion; user/tailor resolves it |
| 1:45–2:20 | Versioned brief, WhatsApp share action, tailor's second-phone review and approval tied to that revision |
| 2:20–2:45 | Show concise model/step trace, private-media access, refresh recovery and an honest measured result |
| 2:45–3:00 | Explain startup wedge, pilot evidence and next validation step |

Generation may take longer than the video slot. Record a real completed run and label any edit/time compression. For live judging, start a new real job and use a clearly labelled previously completed run while waiting. Never pass recorded/cached artifacts off as fresh inference or fake WhatsApp delivery.

### 19.3 Submission artifacts

- Public repository or organizer-required source access, with all secrets/private fixtures excluded.
- Build disclosure: baseline features, dated event additions, third-party work and continued infrastructure dependencies.
- Model manifest: exact IDs, roles, actual successful call evidence, prompt/schema versions and caveats.
- Small evaluation report: sample sizes, completion rate, measured latency/cost, tailor corrections and known failures.
- Architecture diagram and local/staging setup instructions.
- Demo video, working URL, safe judge access and separately labelled sample data.
- Known limitations: manual measurement dependency, narrow template coverage, illustrative fabric fidelity, no automatic cutting patterns.

Use actual judges' criteria once retrieved. Until then, optimize for the publicly stated Startup-track bar: a working real product, sound engineering and a clear beneficiary.

## 20. Full-product roadmap after submission

| Horizon | Deliverable | Evidence required to advance |
| --- | --- | --- |
| Weeks 1–2 | Complete approved database/media migration, deletion/backup procedures, studio roles and invitations | Reconciliation, restore test, privacy review, no wallet discrepancy |
| Weeks 3–4 | Repeatable pilot with 5–10 studios; garment-template editing/review; paid-plan experiment | Repeated use, measured clarification time, actual willingness to pay |
| Weeks 5–8 | Additional validated garments, versioned price lists and quote acceptance | Template-specific production feedback and cost accuracy |
| Later, separate research gate | Controlled photo measurements, pattern drafting and calibrated material estimates | Paired ground truth, subgroup/failure analysis, professional validation and safe abstention |

Do not expand the garment catalogue or add automated cutting until the initial workflow produces briefs tailors consistently trust. Track actual manufactured outcomes before claiming fit or waste improvements.

## 21. Risks and explicit mitigations

| Risk | Severity | Mitigation / cut decision |
| --- | --- | --- |
| Existing app is ineligible or event-work boundary unclear | Critical | Obtain rules and organizer clarification; disclose baseline rather than reconstructing history |
| D1/Clerk migration breaks legacy ownership or credits | Critical | Stable internal IDs, verified identity mapping, reconciled cutover and cross-account access tests; no email-only linking |
| Models unavailable in team region/account | Critical | Test exact models immediately; obtain organizer-confirmed eligible fallback or narrow claims |
| Photo measurements are inaccurate | High | Manual/verified measurements in P0; exclude automatic circumference and fit guarantees |
| Cloth preview changes motifs/scale | High | Side-by-side reference, user confirmation, honest labels; no exact-reproduction promise |
| Fabric calculation implies unsafe cutting certainty | High | Reviewed narrow templates, explicit unknown state, professional verification, no machine-ready patterns |
| Body/measurement data leaks through sharing/caches/logs | Critical | Minimized grants, consent, no-store plus SW bypass, redaction, authorization tests |
| Whole-stack migration consumes the event | High | New slice first; auth/payment/history migration staged and honestly disclosed |
| Duplicate workflow/provider execution costs money | High | Stable IDs, step artifacts, provider reconciliation, one ledger settlement, bounded ambiguity handling |
| Approval is misrepresented as identity or measurement verification | High | Label credential type; separate design approval from verified measurements; invalidate stale approvals |
| Live generation is slow or flaky | High | Measure/rehearse; clearly labelled prior successful run; no fake live results |
| “Agentic” work adds complexity without utility | Medium | One bounded brief agent; deterministic constraints and observable tool outputs |
| Impact claims exceed evidence | High | Report the small sample honestly; no invented customer/revenue/savings figures |

## 22. Final build contract

Fashley is ready to submit when a consenting adult customer can create a project from real fabric, receive a genuine Meta-generated concept, enter measurements, see honest template checks, share one restricted versioned brief and obtain a real tailor's recorded review—on the deployed app, with private media and safe retries.

The full commercial product comes next. A coherent, verified workflow is a stronger hackathon entry than a broad “complete solution” whose measurements, integrations or approvals are simulated.

## 23. Sources and access notes

Research date: **30 October 2026**. Model and Cloudflare documentation were resolved and retrieved using Context7; web research used the configured DeepSeek search/fetch wrapper. No credentials or private participant pages were accessed.

- **[S1] Organizer details:** https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details — login-gated; user-provided email used, not authenticated rules.
- **[S2] Official public application listing:** https://cerebralvalley.ai/e/meta-ai-developer-hackathon/apply — indexed official event text confirms dates, tracks, themes and advertised model families.
- **[S3] Meta event page:** https://dev.meta.ai/events/global-hackathon — indexed official text; direct fetch returned region/identity interstitial.
- **[S4] Meta model catalogue:** https://dev.meta.ai/docs/models and https://dev.meta.ai/docs/getting-started/models — Context7 plus indexed official text; exact model IDs and model scope.
- **[S5] Meta image generation/editing:** https://dev.meta.ai/docs/image-generation — Context7; multi-reference inputs, edit endpoint and response formats. Direct fetch blocked by region/identity screen.
- **[S6] Meta media segmentation:** https://dev.meta.ai/docs/media-segmentation — Context7; SAM 3.1 inputs, outputs and Responses API.
- **[S7] Meta overview/pricing:** https://dev.meta.ai/docs/overview and https://dev.meta.ai/docs/pricing-rate-limits — indexed official overview and Context7 documentation. Account pricing/entitlements still require live verification.
- **[S8] Cloudflare TanStack Start guide:** https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start — Context7; framework hosting and R2 access.
- **[S9] Cloudflare Workflows:** https://developers.cloudflare.com/workflows — Context7; durable image-processing workflow pattern.
- **[S10] Workflows API:** https://developers.cloudflare.com/workflows/build/workers-api — Context7; durable step semantics. Actual deployment/plan limits require implementation spike.
- **[S11] Official Claude winner announcement:** https://x.com/claudeai/status/2049523899918934384 — fetched organizer/model-provider announcement identifies Wrench Board silver.
- **[S12] Official ClaudeDevs technical announcement:** https://x.com/ClaudeDevs/status/2049644705680601300 — fetched; MaestrIA prize and price-validation/WhatsApp drafting pattern.
- **[S13] Wrench Board repository:** https://github.com/Junkz3/wrench-board — fetched; award statement and current specialist-workbench design. Current code/features are not a frozen event submission.
- **[S14] Official Meta Llama 3 recap:** https://ai.meta.com/blog/llama-3-hackathon-recap-cerebral-valley/ — fetched; confirms OpenGlass first place and 24-hour event scope.
- **[S15] Event Discord entry:** https://cerebralvalley.ai/e/meta-ai-developer-hackathon/discord — login-gated; no Discord messages read.
- **[S16] Event waiver:** https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver — direct fetch returned loading shell; indexed excerpts are not a substitute for the accepted Official Rules.
- **[S17] User-supplied reference:** `hackathon/Meta-Hackathon-10-Ideas (2).pdf`, parsed text supplied in conversation — source of provisional rubric, proposed Fashley Tailor concept and submission-policy claims.
- **[S18] Local prototype source:** files listed in Section 9 and `AGENTS.md` — inspected without reading `.env`, modifying application behavior or rerunning application tests.
- **[S19] Cloudflare D1 documentation:** https://developers.cloudflare.com/d1/worker-api/d1-database/ , https://developers.cloudflare.com/d1/platform/limits , https://developers.cloudflare.com/d1/reference/time-travel/ and https://developers.cloudflare.com/d1/best-practices/read-replication/ — retrieved through Context7 for the subsequent database comparison; batch semantics, limits, recovery and sequential consistency.
- **[S20] Turso documentation:** https://github.com/tursodatabase/turso-docs/blob/main/sdk/ts/reference.mdx and https://github.com/tursodatabase/turso-docs/blob/main/sdk/http/reference.mdx — retrieved through Context7; libSQL transactions and remote HTTP interface. Confirm the actual Turso product/SDK chosen before implementation.
- **[S21] Clerk TanStack Start documentation:** https://github.com/clerk/clerk-docs/blob/main/docs/getting-started/quickstart.tanstack-react-start.mdx , https://github.com/clerk/clerk-docs/blob/main/docs/reference/tanstack-react-start/clerk-middleware.mdx and https://github.com/clerk/clerk-docs/blob/main/docs/guides/development/deployment/production.mdx — retrieved through Context7 after owner selected Clerk; official SDK, middleware, explicit CSRF protection and authorized origins. Existing-user migration still requires a separately verified implementation plan.
