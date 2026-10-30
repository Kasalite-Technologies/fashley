# 04 — Frontend pages, elements and interaction specification

This is the new product UI specification, not a reskin of the Lovable demo. Build with existing local **shadcn/ui** components, React Hook Form + shared Zod schemas, React Query and TanStack routing. Do not change component-library families or introduce a second form library because a newer documentation example uses one.

## 1. Visual language and shared composition

### Direction

A calm, practical tailoring workbench: real fabric is the visual focus; operational facts and human decisions are clearly separated from illustrations. Retain useful existing brand assets and warm sand/ivory, ink-brown and muted-sage semantic tokens. No purple gradients, fake analytics, animated agent avatars, glittering AI panels or invented testimonials.

- Display serif for public hero and page headings; existing sans for form labels, measurements, tables, statuses and all long operational copy. Use existing font tokens rather than adding a font dependency.
- Content max widths: public/owner dashboard ~1,200px; intake form ~760px plus 320px summary rail; document ~900px. Consistent 4/8px spacing scale, 16px mobile gutters, 24–32px desktop gutters.
- One dominant action per panel. Destructive actions are visually separate. Status always includes text/icon and not color alone.
- Public samples use explicitly consented/illustrative assets and visible “Illustrative sample” labels. Private saved designs never appear on public landing pages.

### Reusable component inventory

All `Tailor*` names below are **product compositions to build**, not components claimed to exist in shadcn/ui.

| Product component | Compose from existing primitives | Behavior |
| --- | --- | --- |
| `TailorPublicHeader` | `Button`, `Sheet`, `Separator` | Public desktop nav/mobile menu; reuse brand and working links |
| `TailorAppShell` | `Sidebar`, `Sheet`, `Breadcrumb`, `DropdownMenu`, `Avatar`, `Button` | Projects/New project/Account navigation, Clerk user actions, responsive content |
| `ProjectStatusBadge` | `Badge` + Lucide icon + text | Draft, awaiting review, changes requested, design approved, accepted; never generic “verified” |
| `ProjectCard` | `Card`, `AspectRatio`, `Badge`, `DropdownMenu`, `Skeleton` | Private authorized thumbnail, title/template/time, resume, archive/delete menu |
| `ProjectStepper` | semantic ordered list + `Button`, `Badge` | Six labelled steps, current/completed/needs-attention states; not a fictional installed Stepper primitive |
| `DraftSaveStatus` | text + icon, `Alert` on error | Saving/Saved at…/Unsaved changes/Conflict; no success toast on each keystroke |
| `FabricUploadField` | native file input + `Button`, `Card`, `Alert` | Click/keyboard-first upload, optional drag/drop, actual byte upload progress; rejection summary |
| `FabricSelectionCanvas` | image/overlay SVG or canvas + `ToggleGroup`, `Button`, `RadioGroup` | Original/overlay toggle, selectable region list, keyboard alternative, manual crop with numeric controls |
| `MeasurementField` | existing `Form`/`FormField`/label/message, `Input`, `Select`, `Badge`, `Popover` | Decimal input, unit, required/source/verification labels, guidance; no guessed default |
| `ConstraintCard` | `Card`, `Alert`, `Accordion`, `Badge` | Sufficient/insufficient/unknown, assumptions, grounded quantities and correction CTA |
| `JobStatusPanel` | `Card`, `Skeleton`, semantic step list, `Alert`, `Button` | Real stage, elapsed time, cancel, safe retry; no artificial percentage |
| `ConceptViewer` | `AspectRatio`, `Card`, `Dialog`, `Tabs` | Concept beside original swatch, frozen preferences, fullscreen and clear illustration disclaimer |
| `BriefDocument` | semantic headings/lists/table + `Badge`, `Separator`, `Alert` | Shared owner/reviewer/print renderer using role-specific DTOs; not a screenshot |
| `ShareBriefDialog` | `Dialog`/mobile `Drawer`, `Checkbox`, `Select`, `Input`, `Alert`, `Button` | Explicit data scope, expiry, optional PIN, link creation and user-controlled sharing |
| `ReviewActionPanel` | `Card`, `Checkbox`, `Textarea`, `Input`, `AlertDialog`, `Button` | Separate design approval, verification and acceptance, exact version acknowledgement |
| `EmptyState` | semantic heading/text + `Card`, `Button` | Composition, not dependency on a missing latest-generation `Empty` wrapper |
| `PageError` | `Alert`, `Button` | Safe message + request ID + retry/back; never raw upstream details |
| `EvidenceTimeline` | semantic ordered list, `Badge`, `Separator`, `Accordion` | Revisions, jobs, human actions; redacted evidence, no hidden reasoning |

Existing wrappers already cover buttons, cards, sheets, dialogs, drawers, tables, form, input, checkbox, select, radio, tabs, badges, skeleton, sidebar, sonner, etc. Inspect actual exports before coding. `Spinner`, `Field`, `Empty`, `Stepper` and `FileUpload` are not in the inspected local inventory: use accessible compositions or deliberately add a scoped wrapper after C approval, not imaginary imports. Numeric measurement input uses native decimal input + schema, not a nonexistent specialized shadcn control. No chart library needed for P0.

### Global state rules

- Each page: loading skeleton, real empty state, safe error with retry, unauthorized redirect and missing resource state.
- Form errors inline and at submit summary; focus first invalid field. Form labels include units; placeholders are not labels. `aria-invalid` and linked error descriptions required.
- A disabled control has adjacent explanatory text; tooltip alone is insufficient. Do not make invalid choices look available.
- Success toasts only for meaningful outcomes such as saved revision, share revoked or action submitted; persistent page state remains the source of truth.
- Toasts/step changes use restrained live regions. Respect reduced motion. Keyboard focus stays visible; dialogs have titles/descriptions and restore focus.
- No optimistic approval, credit debit or finalized status. Only server responses can confirm those outcomes.

## 2. Page P01 — Product landing (`/`)

**Purpose:** Explain the real workflow and convert to new/resumed project. This replaces the homepage's demo-led emphasis; do not retain a fake working generation form as the primary product.

Top to bottom:

1. Public header, logo home link, working navigation and sign-in/start button.
2. Hero: “Your fabric. A clearer plan for your tailor.” Supporting line: “Visualize an outfit, capture the details and agree on a versioned brief with your tailor.” Primary “Start a tailoring brief”; secondary “See how it works” anchor.
3. Fabric-to-concept visual: consented fabric swatch, illustrative garment and small sample brief. Captions distinguish actual input from illustrative output. No fabricated live status or approvals.
4. Three workflow blocks: Select your fabric; Confirm design and measurements; Review with your tailor. Plain icons and short copy.
5. Example constraint explanation: sample labelled insufficient fabric/unknown requirements; explicitly illustrative, not measured business impact.
6. Trust strip: “Private by default”, “Manual measurement verification”, “You choose what to share”; link to privacy. No promise of guaranteed fit or zero provider retention.
7. Final CTA + concise FAQ accordion: body photo optional, preview is illustration, measurements need human checking, review links can expire but downloaded copies cannot be recalled.
8. Root legal/contact footer, mounted once.

Signed-in CTA goes to `/tailor/new`; secondary “My projects” to `/tailor`. Signed-out start goes through Clerk with allowlisted return path. No new project or paid job created by visiting the page.

**Components:** `Button`, `AspectRatio`, `Card`, `Accordion`, `Separator`, public header/footer. **API:** none required for public content.

## 3. Page P02 — Authentication and recovery (`/auth`, `/reset-password`)

- Small brand header, title and contextual explanation; mode driven by validated `mode` query parameter.
- Clerk-controlled sign-in/sign-up and recovery flows, not a custom password database. Apply brand appearance using supported Clerk configuration, not fragile selectors hiding security controls.
- Legal/consent links and safe same-origin return path. Preserve intended project route; never use an arbitrary external `redirect` URL.
- Loading, provider error, interrupted callback, invalid recovery, expired session and already-signed-in redirect states.
- No prompt claiming legacy passwords already work in Clerk. Legacy-account access has a separate gated support/claim procedure; if not implemented, say so.
- `/reset-password` delegates to Clerk's verified supported recovery flow; old Supabase token handling remains isolated until explicit cutover, never automatically translated.

**Ownership:** B supplies UI; C integrates routes/provider/middleware and validates actual SDK behavior with A.

## 4. Page P03 — Project dashboard (`/tailor`)

Top to bottom:

1. App shell; heading “Your tailoring projects”; primary “New project”.
2. Search `Input` labelled “Search projects”, debounced request (~300ms), and status `Select`: all/active/archived. Secondary review-state filter: all/awaiting review/changes requested/design approved/accepted. Filter state in validated URL search parameters.
3. Project card grid: 1 column mobile, 2 tablet, 3 desktop. Thumbnail (authorized concept or swatch, neutral placeholder if unavailable), title, garment, last updated, input revision, current brief status and “Continue project”. Card menu: View brief (if any), History, Archive/Restore, Delete.
4. Cursor “Load more” button; do not render fabricated total counts.
5. Small usage line from `/me`: available/reserved pilot credits, with explanatory note and no real top-up CTA for this slice.

Empty states: no projects → short explanation + “Create your first brief”; no matches → reset filters; all archived → show restore option. Deletion uses `AlertDialog` with clear revocation/cleanup warning and title confirmation for accidental-delete protection. Archive does not delete media or revoke links.

**API:** `/me`, project list, archive, delete. List summaries do not fetch full measurement content. Do not display client-generated “0 projects” while data is loading.

## 5. Page P04 — New project (`/tailor/new`)

One short form, not a modal wizard:

| Element | Control / validation |
| --- | --- |
| Project title | `Input`, required 1–100 chars; sensible editable placeholder, not silently persisted default |
| Garment | Published template `RadioGroup` cards with illustration, name and supported-domain note; exactly one required |
| Occasion | `Select` reviewed options plus Other + short text; optional |
| Fit | `RadioGroup` regular/relaxed/fitted with guidance; template restricts unsupported values |
| Needed by | Optional date via `Popover`/`Calendar` or accessible native date input; past date warning, not a booking promise |
| Expectation acknowledgement | Plain notice “Concepts are illustrations; your tailor must confirm fit and construction.” No blanket bundled privacy consent |
| Footer | Cancel → dashboard; “Create project” → API then workspace Fabric step |

No published templates: explanation and disabled creation with contact/back option, not arbitrary template IDs. Duplicate submit reuses one idempotency key. A successful create immediately persists project; refresh must restore it.

**API:** templates, create project. Template numerical rules need actual review, not a fabricated seed.

## 6. Page P05 — Project workspace (`/tailor/projects/$projectId`)

### Persistent frame

- Breadcrumb Projects → current project; template name; current input revision; latest finalized brief status.
- “History” action, “View current brief” if available, save state and overflow Archive/Delete.
- Six-step progress navigation. Completed = relevant persisted facts, not simply visited tab. Accessible step labels and error count.
- Form area + right summary rail desktop; rail collapses to `Accordion` on mobile. Rail shows current template, fabric facts, selected concept, missing facts and the **brief version actually shared**, if any.
- Bottom actions: Back, Save draft, Continue. Generate/Compile/Share are explicit action buttons within their appropriate steps. Saving and generating are not synonymous.
- Draft editing lives in memory and server draft. Debounced server autosave for non-file changes is allowed (~800ms) after first explicit save; do not autosave before a field is valid at draft level. Show failures and block freeze until latest save succeeds. Navigation warning for unsaved edits.
- On version conflict: `Alert` with Reload latest; preserve current in-memory inputs for comparison/copy, never blind overwrite. Do not store conflict copies with measurements in localStorage.

### Step 1 — Overview

Title, occasion, deadline/timezone, fit, garment template/version and 2,000-character customer notes with counter. A template change warns that design options, measurement requirements and downstream brief may need re-generation. Keep valid old values only where schema meaning matches; do not reinterpret waist measurement as garment width.

Show a compact checklist: fabric added, region confirmed, concept selected, required measurements entered, brief finalized. “Continue to fabric”.

**API:** project detail, template detail, draft save.

### Step 2 — Fabric

1. Capture instructions `Alert`: lay flat, clear light, include enough pattern detail. “A photo cannot establish how much fabric you have.”
2. Processing purpose consent checkbox + policy link; separate from future person/share/demo consent. Obtain consent before upload intent.
3. `FabricUploadField`: Choose photo, supported formats/10 MiB limit, filename/size (not logged), transfer progress, cancel upload, replace/remove selection. Smartphone native file picker supports camera where available; no custom camera capture in P0.
4. Sanitization state: Uploading → Checking image → Ready/Rejected; no display as accepted or provider processing until sanitized. Retry upload after rejection, safe error explanation.
5. Original image pane; explicit “Find fabric regions” action with server quote. Freeze saved draft before analysis. Job panel survives route refresh.
6. SAM overlay with selectable region badges/list. Original/overlay `ToggleGroup`, legend, selected region outline and “Use selected fabric”. If multiple regions, none silently chosen. Real SAM failure labelled failed; manual crop is a separate method, not “AI mask success”.
7. Manual fallback: “Select manually” opens crop UI with drag handles **and** numeric x/y/width/height controls or keyboard adjustment. Server creates crop. Replace image remains available. If cropping capability unavailable, explain and offer re-upload, never fake it.
8. Physical fabric form: usable width + unit, usable length + unit; directionality yes/no/unknown; stretch yes/no/unknown; pre-shrunk/not pre-shrunk/unknown. Blank dimensions accepted in draft; unknown visibly affects constraint result. Entered decimal preserved; converted value visible on unit switch, never silent double conversion.
9. Spark observations rendered as suggestions with uncertainty and confirm/edit controls. Composition/stretch/yardage cannot be asserted from pixels. Saving a confirmed profile stores observations as facts with origin labels.
10. Continue → Design; absent fabric selection offers clear task link, not a misleading green completed step.

**API:** consent, upload intent/PUT/complete/status, freeze revision, analysis job/status, fabric-selection, draft save. Quote is server config from `/me`, not client pricing.

### Step 3 — Design and concept

- Left panel: confirmed swatch and template illustration; original available in dialog.
- Template-controlled design preferences using `Select`/`RadioGroup` cards (e.g. sleeve/neckline/length only if actually in selected template). No open client-authored system prompt. Customer notes remain untrusted preference data.
- Person reference `RadioGroup`: “Neutral mannequin” default; “Use my photo” only if server capability enabled. Photo option requires separate person-processing consent and adult/clothed-image acknowledgement. Upload optional and removable. Do not imply checkbox-only age verification guarantees compliance.
- Cost/usage sentence + “Generate concept”. Handler saves draft, freezes exact input revision, then starts one keyed job. Repeated button press/navigation does not start another job.
- Job panel: queued/current stage/elapsed/retry/cancel. Browser reopen restores persisted latest job. Retry_wait honors delay; ambiguous outcome needs explicit cost acknowledgement before authorized retry.
- Completed `ConceptViewer`: concept and swatch side by side desktop, tabs/stack on mobile; frozen option labels; “Illustrative preview — not a guarantee of fabric scale, drape or fit.” Show actual model provenance in collapsed details, not decorative model badges for unused models.
- “Use this concept” writes selected asset into draft. “Change preferences” visibly marks previous concept as based on earlier input; regenerate explicitly. Old output is never relabelled using current controls.
- One concept at a time P0. No carousel of fictional variants/angles. Regeneration warns of additional cost and retains old persisted versions in history.

**API:** draft/freeze, concept job/status/cancel/retry, asset; upload/consent when enabled.

### Step 4 — Measurements and feasibility

1. Explanation: manual measurements need tailor verification; not an automatic photo-sizing system.
2. Display-unit `ToggleGroup` cm/in; templates supply required/optional labels and tape-measure guidance. Unit setting is a display preference and does not rewrite canonical values silently.
3. Field per template: name, required marker, body-vs-garment label, decimal input, unit, source `Select` customer manual/tailor manual, guidance `Popover`, source/verification `Badge`. Default source is customer manual. Missing field stays blank. Existing experimental estimate is read-only labelled unvalidated, never offered as a P0 measurement source choice.
4. Required and optional sections; mobile stacked fields, desktop readable rows. Server validation flags impossible configured-domain values, no invented anthropometric ranges. Never use sliders for precision body measurements.
5. “Save and check requirements” saves/freezes then calls deterministic checks. Show missing versus entered-but-unverified separately.
6. `ConstraintCard`: known inputs, result sufficient/insufficient/unknown, available/required length only if supported, reviewed rule version/domain, expandable assumptions. Insufficient CTA links to fabric/design; unknown says “Tailor estimate required,” not green success.
7. Warn that editing a relevant value requires new brief and reviewer approval. Current shared brief retains its original values until superseded.
8. Continue to Brief allowed even if missing facts, with warning: an incomplete brief can collect questions, but cannot be accepted for production preparation.

**API:** template detail, draft/freeze/checks. Customer cannot click their own measurements to verified.

### Step 5 — Build the brief

- Summary cards for chosen concept, fabric, template, source-labelled measurements, fit, deadline and customer questions.
- Questions list `Textarea` entries (up to 10 × 500 characters), remove/add controls; concise structured decisions from confirmed inputs. No unsupported WYSIWYG editor.
- Readiness checklist with concrete links to missing fields. Distinguish blockers to compiling/finalizing from blockers to acceptance.
- “Compile brief” saves/freezes current draft then starts Wonder job. Progress/retry behaves like concept generation but does not regenerate image.
- Completed document preview shows AI-produced assumptions/questions separately from confirmed input and numerical rule output. Owner corrects source facts and recompiles if wrong; no in-place edits of frozen generated content.
- “Finalize version N” with confirmation of exact source revision and acknowledgement of unresolved production questions. Fatal missing structure blocks; unresolved production facts may finalize with “Incomplete — tailor review required.” A new finalization warns that old review links are revoked and old approvals do not transfer.
- Success navigates to owner brief view. No “Ready to cut” banner.

### Step 6 — Handoff

Current finalized brief number + status, “Open brief and share”, review summary and last human action. If no finalized brief, show compile/finalize task link. Do not duplicate the document editor or share form; use page P06.

## 7. Page P06 — Owner brief (`/tailor/projects/$projectId/brief`)

Query `briefId` selects history; absent selects latest brief. Server verifies project linkage. Header explicitly labels historical/superseded versus current.

Top actions: Back to project, History, browser Print/Save PDF, Share for review (current finalized only), Correct inputs/create new version. Print must work without creating a share.

### Document content order

1. “Tailoring brief”, project title, brief number, input revision, created/finalized time, status.
2. Disclaimer: design illustration; professional measurement/construction judgment required; not a cutting pattern.
3. Selected concept + swatch, with descriptive captions. Person reference only if present and permitted; original person image is not automatically required.
4. Garment template/version, occasion, desired date, fit and confirmed design decisions.
5. Fabric usable dimensions, entered units, confirmed properties; constraint result, reviewed-domain assumptions or unknown explanation.
6. Measurement table: body/garment, value/unit, source, verification status/actor/time. Missing stays “Not supplied”, never “0”.
7. Materials/trims with known/unknown quantities and provenance. No AI-generated prices or sewing instructions represented as approved facts.
8. Confirmed notes, assumptions and required/unresolved questions, visually distinct.
9. Review summary with separate design approval, measurement verification count and acceptance. Names labelled asserted/verified based on actual credential type.
10. Evidence summary and revision disclaimer. Full job/tool traces remain owner history only and never hidden reasoning.

### Share dialog exact elements

1. Brief number/hash hint and warning that forwarded/downloaded copies cannot be recalled.
2. Asset checklist with thumbnails: swatch/concept selected as defaults, original person unchecked. Reject/disable asset whose consent is unavailable.
3. Measurements checkbox **unchecked by default**; when enabled show list/count of included measurements.
4. Allowed actions: design approval/change request by default; verification/acceptance disabled with explanation until measurements included. Acceptance still subject to actual backend prerequisites.
5. Expiry `Select` 1/6/24 hours (default 24).
6. Optional PIN switch + password-style input; advise separate communication. PIN does not verify identity. Never print or automatically append PIN to WhatsApp text.
7. Explicit tailor-share consent covering selected data/policy version, with preview of omitted/included sections.
8. “Create review link” button. Then read-only link field, Copy link, “Open WhatsApp” with encoded prefilled minimal message, and Close. No backend send; user confirms inside WhatsApp.
9. Raw link kept only in current dialog memory. After refresh or ambiguous create replay: explain it cannot be recovered; revoke/create new link if needed. No persistence in browser storage.

Below document: grant list with creation/expiry/status and “Revoke” confirmation. Never show recoverable raw links/PINs in list. Immediate revoked state requires server response. Expired/revoked link not presented as usable.

**Print:** white background, dark text, hide nav/actions/dialog/footer chrome, document-specific legal line visible, no token/URL/PIN, no clipped tables, repeat table headings where supported, avoid splitting image/caption groups, show brief/revision and disclaimer. Browser PDF copies remain outside revocation control.

**API:** brief, grant list/create/revoke, draft route for corrections. Owner polling after sharing refreshes review summary (e.g. 10s while visible); no websocket dependency.

## 8. Page P07 — History (`/tailor/projects/$projectId/history`)

Breadcrumb and project title, Back to project, chronological `EvidenceTimeline` with:

- Input revision number/date, template, summary of changed field **names**, view immutable inputs action.
- Concept jobs with stage/outcome/model IDs and safe request-ID details; input snapshot labels.
- Brief versions with current/superseded/draft badges and “View version”.
- Human actions: asserted reviewer name, credential method, exact version, action/time and owner-visible note.
- Consent/share events only as safe summaries; never raw review token, person media in list or prompt text.

Read historical input in a sheet with explicit “Use as new draft” confirmation. This copies values through current draft-version validation, does not mutate old revision, inherit approval or claim old deleted assets are available. Missing assets are labelled unavailable; saving invalid references is rejected.

No complex side-by-side diff editor in P0. Pagination required for timeline. Empty history explains draft has not been frozen yet.

## 9. Page P08 — Review entry (`/review/$token`)

Minimal standalone entry content: Fashley mark, “Open a private tailoring brief”, optional PIN field, privacy warning and “Open secure brief”. No project name, thumbnail, measurements, third-party fonts/analytics or Open Graph previews. GET/prefetch does not consume link or trigger action.

Client holds initial token only until exchange. On success replace URL with `/review` **before** fetching content. On failure show generic invalid/expired/revoked credential state without enumerating valid PIN tokens. Rate limits show retry delay. Token never goes into query keys, browser persisted storage or error reports. Test deep-link access and messaging preview behavior.

**API:** review exchange. C configures no-referrer/CSP/no-store and logging protections at route/edge boundaries.

## 10. Page P09 — Tailor review (`/review`)

Standalone mobile-first document plus sticky review actions; no owner navigation or account requirement.

1. Review header with exact brief number, expiry and active grant notice. “This link grants access; the sender has not verified your identity.” PIN still possession-based.
2. Allowlisted `BriefDocument`; permitted assets load only through review asset endpoint. Omitted sections are visibly labelled “Not shared by customer”. No measurement leakage in summary, notes, image alt text or snapshot JSON.
3. Name `Input` (asserted reviewer name), not a fake verified badge.
4. **Request changes:** opens dialog with required note, exact version confirmation, submit. Success banner “Changes requested for version N”; disables approval/accept on that version. Does not edit customer's draft.
5. **Approve design:** separate confirmation listing concept/template, “This does not verify measurements.” Optional note; submit persists exact content hash. Success design-approved badge; no acceptance shortcut.
6. **Verify measurements:** only if granted. Required measurement list shows exact values and source. Select each checked manually, choose verification method and confirm “I checked these values.” Explicit experimental estimate is not verifiable; request a manual value/new brief. Submit selected attestations; already verified entries show actor/time. Link users cannot edit numbers in place.
7. **Accept production-preparation brief:** separate final action. Visible checklist: design approved, all required measurements verified, reviewed fabric sufficiency, required questions resolved. Server capabilities control availability; disabled state lists missing conditions. Confirmation says “This is not a machine-ready cutting pattern.”
8. Receipt with action, version, actor method and time. Reload shows persisted receipt; duplicate submit uses the same key.
9. Exit clears review session and replaces page with non-sensitive confirmation.

Invalid/expired/revoked/superseded session removes private content from memory and stops media/job polling; show “Ask the customer for a current link.” A stale action conflict fetches current session; it never silently applies to a newer brief.

**API:** review session/assets/actions/logout only. No owner project or job APIs. One active grant per browser review session; opening another explains replacement.

## 11. Page P10 — Account (`/account`)

- Profile/security card: display Clerk-controlled identity, supported manage-profile/security flow, sign out. No locally stored password form or invented identity controls.
- Preferences card: cm/in default and timezone, explicit Save; show saved/error state.
- Privacy card: purpose-specific consent list with date/policy/scope and Withdraw action. Confirmation explains processing/share revocation and deletion/export limitations; refresh status from server.
- Retention explanation from actual config; link to privacy/contact for legacy account claiming or support. No automated account-deletion button until a full verified deletion endpoint/process is implemented. Project deletion lives in dashboard/workspace.
- Usage card: available/reserved credits and pilot note. No payments, subscription selector, fake billing history or top-up CTA.

## 12. Supporting pages and application-level failures

- About: product mission, Ghanaian tailoring context as hypothesis, honest model/human roles. No invented tailor endorsements.
- Contact: working channel/form only if existing backend supports it; no dead submit button.
- Privacy/Terms: update actual providers, processing/sharing/public-demo distinctions, retention, exported copies, verification limits and support path. Owner/legal review before live customer release.
- 404: safe generic resource-not-found, home/projects CTA appropriate to session; no existence leak.
- Root error: safe message, retry/home and request ID; avoid existing global reporters receiving review URLs or sensitive errors.

## 13. Client integration contract

- Typed `tailorApi` is the only feature fetch boundary. No direct D1/R2/Meta/Clerk-secret/Supabase calls in new feature components.
- Query keys include internal user ID + resource ID, never tokens/PINs. Clear user/review caches on sign-out/session replacement. Do not persist sensitive queries.
- Poll jobs at ~2s visible/~10s hidden, honor `retryAfterMs`/429 and stop at terminal state or inaccessible resource; no parallel duplicate timers. Poll upload status similarly until terminal. Refresh/reopen reads server job state, never automatically POSTs work.
- Carry one idempotency key through uncertain retries. A new deliberate generation uses a new key. Do not auto-retry POST on arbitrary transport failure without replaying the same key.
- Asset display through authenticated same-origin endpoints; revoke local blob URLs on replacement/unmount and render ready assets only. Prevent private data in SSR public metadata.
- Dirty draft may diverge from last generated concept; label divergence using input hash/snapshot, not editable state. Save/freeze/generate is a visible error-aware sequence.
- Test-only adapters obey identical schemas and emulate conflicts/latency/failure. Explicit fixture mode in tests/development only; production startup must not silently fall back to mocks.

## 14. Responsive/accessibility checklist

- Test at 375px, 768px and 1,280px; 200% zoom and keyboard-only flow. Prefer 44px touch targets; don't obscure errors/actions behind sticky footers or safe-area insets.
- Measurements stack on mobile; only actual tables use contained horizontal scrolling. No full-page horizontal overflow. Crop selection has non-pointer alternative.
- Use native form semantics, descriptive alt text without sensitive measurement values, meaningful button names and `aria-current=step`/`aria-expanded` as appropriate.
- Focus moves to page heading after route changes and error summary after submit failures. Dialog traps/restores focus; sheet and accordion remain keyboard operable.
- Announce stage changes without repeatedly interrupting screen readers. Real upload progress may use `Progress`; AI progress is indeterminate factual status.
- Test final print preview at A4 and letter without clipping, missing revision labels, tokens or misleading approval status.
