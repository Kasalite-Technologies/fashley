# Fashley Events and Admin: implementation plan

Status: free-registration implementation submitted for review. This document is the original plan, not a completion checklist; see `docs/events-release.md` for delivered scope and release gates.
Research date: 15 November 2026.

## Product brief

Add Events to Fashley's navigation. People can find fashion events, submit their own events for review, and register on Fashley. Build a dedicated admin workspace, closely reproducing the Notion database UI requested by the owner, with events as its first managed area.

The public experience remains recognizably Fashley. The admin experience is a working database workspace, not a marketing dashboard with decorative charts. This plan does not authorize deployment, paid services, production data changes, or replacement of existing studio functionality.

## Recommended launch boundary

Ship a complete moderated directory with native free registration, attendee tickets, organizer management, email notifications, capacity controls, waitlists, and check-in. Include multi-day, in-person, online, and hybrid events. A single general-admission ticket per person per event keeps the first release tractable.

Treat paid ticketing as a separately approved release, not a small extension of registration. This recommendation is provisional: the owner may require paid tickets at initial launch. If so, the payment phase below becomes a launch dependency.

External ticket links can be an explicitly labeled directory-only mode if approved. They must never be presented as registration completed on Fashley. Native registration is the default and fulfills the requested on-platform signup flow.

### Decisions to confirm before implementation

| Decision           | Proposed default                                                                        | Why it matters                                                                     |
| ------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Launch geography   | Ghana first, with country/city fields and explicit event timezones supporting expansion | Determines initial filters, launch content, and operating policies; not a geoblock |
| Registration model | Free native RSVP first; paid tickets in a later approved release                        | Payments introduce refunds, disputes, settlement, and organizer verification       |
| Identity           | Public browsing; Clerk sign-in and verified email for submissions and registration      | Reuses identity and limits spam without introducing another account system         |
| Organizer powers   | Submit and manage their own listings/attendees; Fashley controls publication            | Prevents immediate public spam while allowing self-service                         |
| Admin reference    | Notion light-mode database workspace; Plus Jakarta Sans retained                        | Keeps the requested layout without silently replacing the owner's global font      |
| Email delivery     | Choose a transactional provider and verify its sending domain                           | Confirmation, cancellation, and reminder delivery are launch dependencies          |
| Operating policy   | Owner approves event rules, privacy retention, support contact, and moderation owner    | Someone must handle reports, cancellation disputes, and attendee data requests     |

## Research and what to adopt

Public product documentation and publicly readable pages were inspected. No authenticated organizer checkout was completed, no private systems were accessed, and no proprietary backend behavior was inferred as fact. Visual measurements and a pixel-level comparison against a selected Notion screen still belong to the design phase. One FashionGHANA calendar article was blocked by bot protection; it is not used as verified source evidence.

| Source                            | Observed behavior                                                                          | Fashley decision                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Luma event creation [S1]          | Separate event basics, timezone/location, registration settings, guest management          | Use a short creation flow, then a management page; do not expose every setting at once                         |
| Luma waitlist [S2]                | Event-wide capacity; waitlisted guests do not occupy confirmed seats; manual host approval | Start with explicit organizer promotion, never an implied guaranteed place                                     |
| Luma guest table [S3]             | Searchable guest records and selected-row bulk actions                                     | Admin and organizer tables with scoped actions and per-record outcomes                                         |
| Luma check-in [S4]                | QR tickets, manual name lookup, duplicate/invalid ticket feedback, restricted door staff   | Online check-in with manual fallback; minimize door-staff data access rather than copying its broad visibility |
| Eventbrite creation [S5]          | Event page, tickets, attendee questions, preview/publish, organizer profile                | Collect real event information, preview before submission, collect only useful attendee fields                 |
| Eventbrite refunds [S6]           | Organizer refund responsibility and special cancellation/postponement handling             | Define responsibility before enabling paid tickets; do not copy provider-specific deadlines                    |
| eGotickets fashion directory [S7] | Fashion category and country-specific discovery, account access to tickets/events          | Fashion-specific taxonomy and local discovery; retrieved page exposed limited listing detail                   |
| Notion database views [S8]        | View tabs, property columns, filter/sort/group controls, side peek/full page               | Reproduce this interaction model for moderation and event management                                           |
| Notion boards [S9]                | Status-grouped records and controlled visible properties                                   | Add a moderation board after the table works; no unrestricted drag-to-publish shortcut                         |

Fashley should borrow these proven workflows, not reproduce every Eventbrite or Notion feature. Exclude a generic page builder, arbitrary database schemas, social feeds, referral schemes, and invented audience statistics.

## People and permissions

| Actor                       | Allowed actions                                                                                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visitor                     | Browse published events, filter/search, view public organizer information, share links, report a listing                                                                                 |
| Attendee                    | Register once per event, view own ticket/status, join/leave waitlist, cancel, access private joining details when confirmed                                                              |
| Organizer                   | Create an organizer profile, save drafts, submit/revise/withdraw own events, manage own attendees, close registration, promote waitlisted people, check in guests, request event changes |
| Event-scoped check-in staff | Check ticket validity and record admission for assigned events; see minimal attendee details, not exports or full answers                                                                |
| Events editor               | Review submissions/revisions/reports, request changes, approve/publish/unpublish, correct listings, feature events, manage categories                                                    |
| Platform admin              | Events-editor capabilities plus staff role grants/revocations, notification recovery, audit access, platform event settings                                                              |

Roles are enforced server-side for every request, not by hiding navigation. Organizers are not platform staff. Scope every attendee query/export to an authorized event. Separate publishing permission from attendee-data export permission. No email-domain or client-metadata shortcut grants admin access.

Bootstrap the first platform admin through an owner-approved server-side operation tied to the verified Clerk subject/local user ID. Record the grant. Prevent accidental removal of the last platform admin. Require stronger authentication for platform staff where the Clerk configuration supports it; verify that configuration rather than claiming it exists.

## Routes and navigation

| Route                                 | Purpose                                                                |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `/events`                             | Public directory, search/filter URL state, upcoming/past views         |
| `/events/$slug`                       | Public event detail and registration entry point                       |
| `/events/submit`                      | Signed-in event creation and submission                                |
| `/events/mine`                        | My registrations and tickets                                           |
| `/events/mine/$registrationId`        | Own registration detail, QR ticket, calendar and cancellation          |
| `/organizers/$slug`                   | Public profile and published upcoming/past events                      |
| `/organizer/events`                   | Own event drafts, submissions, published listings                      |
| `/organizer/events/$eventId`          | Own event details, revisions, registrations and notifications          |
| `/organizer/events/$eventId/check-in` | Assigned organizer/door-staff scanner and manual lookup                |
| `/admin`                              | Redirect to events, the first working admin area                       |
| `/admin/events`                       | Notion-style event database and saved views                            |
| `/admin/events/$eventId`              | Deep-linkable full editor, also opened as side peek from table         |
| `/admin/organizers`                   | Organizer review, contact and suspension                               |
| `/admin/reports`                      | Listing reports and resolution                                         |
| `/admin/activity`                     | Read-only staff action history                                         |
| `/admin/settings`                     | Authorized staff, categories, event policy and notification operations |

Reserve static event paths so they cannot be consumed as slugs. Keep event IDs stable when a title changes; maintain redirects for approved slug changes. No private event or ticket data in public slug lookups.

Add Events after Discover in the shared desktop/mobile header. Add Events and My events to signed-in navigation without removing studio links. Re-measure the Tubelight indicator and test the six-item header at intermediate widths. Show an Admin entry only to authorized staff, but protect `/admin` independently. Do not add empty future management modules to the sidebar. Preserve the root footer and legal links.

## Public event discovery and detail

### Directory

- Page title: Fashion events. Actions: Submit an event and My events.
- Search event name, public organizer name, and city. Filters: date range, city/country, category, attendance format, and registration availability. Keep filters in validated URL parameters; back/forward and shareable filtered links work.
- Initial categories: fashion shows/runway, fashion weeks, pop-ups/markets, exhibitions/trade fairs, workshops/classes, talks/networking, fabric/textile events. These are proposed taxonomy, not claims of existing listings.
- Default to upcoming/ongoing published events, sorted by start time with stable pagination. Offer a clearly separate past-events view. Use the event timezone for date filtering, with the selected convention visible.
- Cards show an approved cover, title, date/timezone, city or Online, organizer, category, and real registration state. No fabricated sold-out labels, attendance counts, or scarcity.
- Featured placement is a logged editorial choice with optional expiry, separate from moderation approval. Hide the featured section when empty.
- Empty results offer Clear filters. An empty directory invites genuine submissions, not fake event cards.

### Event page

- Approved poster/cover, title, organizer link, date range/timezone, format, venue and public address, description, agenda if supplied, access requirements, accessibility information, registration policy, and contact/report controls.
- Registration panel shows the true state: Register, Join waitlist, Already registered, Registration closed, Event cancelled, Postponed, or Event ended. Mobile CTA must not cover content or footer.
- Share and downloadable calendar entry. Calendar entries have stable UID and revision sequence; private joining links never appear in a public calendar file.
- Online meeting links and sensitive entry instructions are returned only to confirmed attendees, authorized organizers, or staff. Keep public city separate from any private address.
- Cancellation/postponement stays visible with a clear notice. Do not silently delete a listing people have registered for.
- Server-render public content, canonical metadata, social preview, sitemap inclusion, and accurate Event structured data. Represent real status, dates and offers only. Draft/review/admin/ticket pages are excluded from indexing.
- Related events use actual published records or are omitted.

## Organizer submission and review

1. Sign in, verify the chosen email address, and create/select an owned organizer profile. Capture public name/bio/contact preference and private operational contact separately.
2. Enter basics: title, summary, category, description, cover/alt text, format, start/end, IANA timezone, location or private meeting link, access/age requirements, and an optional agenda.
3. Configure native registration: opening/closing times, capacity or explicit unlimited capacity, waitlist enabled/disabled, and a small bounded set of attendee questions. Default name/email; phone and accessibility requests optional and purpose-explained.
4. Review the real event-page preview. Accept submission/content-rights terms and submit. Server validation requires end after start, valid timezone, future/ongoing dates, registration cutoff no later than the configured event boundary, and suitable location information.
5. Admin queue shows Pending review. Admin checks fashion relevance, source/organizer credibility, duplicates, dates/location, image rights, misleading claims, dangerous links, and prohibited content.
6. Admin publishes, requests specific changes, or rejects with a reason. Store actor, reviewed revision, timestamp and message. Organizer sees status in their dashboard and receives a notification.
7. Requested changes can be edited and resubmitted. Rejection does not erase evidence; appeal/contact information is available. Organizers may withdraw their pending submissions.

Autosave drafts to D1 with an explicit saved/error indicator and version checks. Keep an unsaved form in memory across sign-in where feasible; do not persist attendee PII in browser storage. Never promise that a form saved when the server write failed.

### Published changes

Keep the currently approved revision live while a replacement revision is reviewed. Title, cover, description, date, venue, private joining details and registration-policy changes require review. No edit to a public R2 object may bypass that approval.

Immediate safety actions are different: the organizer may close registration or cancel an event, and staff may suspend an organizer/listing. Cancellation is irreversible in the first release; correction requires staff intervention and a logged decision. Postponement disables registration until a new reviewed schedule is published. Date/venue changes notify existing attendees and do not silently move them to a different event.

Capacity increases require approval; decreases below confirmed attendance are rejected. Closing registration does not cancel existing registrations. Removing a listing from discovery is not the same as cancelling it. Staff must explicitly choose and explain which action is intended.

## Native registration, tickets and admission

### Attendee journey

1. Select Register on an open published event. If signed out, sign in and return to the same event, without automatically submitting the registration.
2. Review the event schedule and attendance terms. Confirm verified contact information and answer the configured questions. Keep marketing consent separate and unchecked.
3. Submit an idempotent registration request. Server checks event lifecycle, organizer status, registration window and remaining capacity at mutation time.
4. Receive Confirmed or Waitlisted, never an ambiguous success. Reloading shows the same result. An email failure does not undo a valid registration; show the ticket in My events with delivery status and a throttled resend action.
5. Confirmed attendees receive a QR ticket, Add to calendar, access instructions and cancellation control. Waitlisted people see position only if a reliable ordered policy is implemented; otherwise show status without a made-up queue number.
6. Cancellation releases capacity once, revokes admission/access and cancels reminders. Re-registration uses the same person/event record with a new attempt history and fresh ticket credential, subject to current availability.

One person registers for themselves in the first release. Group purchases, ticket transfers, assigned seating, approval-required attendee applications, and multiple ticket tiers are later scope, not half-built controls.

### Capacity and waitlist invariants

- Enforce uniqueness on `(event_id, user_id)`. Duplicate clicks and concurrent requests cannot create duplicate registrations or consume additional seats.
- Use a transaction with database-enforced capacity guards for confirmed-state transitions. Do not read a count, decide in JavaScript, then insert in a separate operation.
- Preferred implementation: transition triggers maintain the event's confirmed count and abort on over-capacity, closed/cancelled event, or invalid state. Registration, idempotency record, counter transition, and notification outbox writes commit together. Prove behavior against real D1/SQLite before committing the API contract.
- D1 `batch()` rolls back on a failing statement [S10]. A successful conditional UPDATE affecting zero rows is not itself an error; never let later statements create a confirmation after a failed seat reservation. Explicit SQL assertions/guards and tested transitions are mandatory.
- On a capacity race, return Capacity changed and offer a separate waitlist action if enabled. Joining the waitlist never reserves a seat.
- Organizer promotion is explicit and atomic. It immediately confirms the selected waitlisted attendee only if capacity remains and registration is open; document that policy. If an offer-and-accept deadline is wanted, implement an expiring held-seat model instead, not a notification with no seat guarantee.
- Do not auto-promote on cancellation in release one. Notify the organizer that a seat is available; promotion produces the attendee confirmation email.
- Cancellation and check-in retries are idempotent. A cancelled ticket cannot become valid through an old replay response. Mutation replays return the operation outcome plus current resource status where appropriate.

### Check-in

QR contains a high-entropy opaque credential, not an email, local user ID, or public sequential identifier. Store its hash; restrict issuance to confirmed registrations. Scanning only presents a credential to an authenticated event-scoped check-in endpoint; opening a QR URL must not mutate attendance.

Verify event, registration, credential and current lifecycle before admission. First scan checks in; repeat scan reports Already checked in with time. Wrong-event, cancelled and revoked credentials are rejected. Undo requires an explicit logged action. Manual lookup is always available when camera permission/scanning fails. Online events show joining access, not a fictitious door check-in.

Require an internet connection for check-in in release one and say so. Do not claim offline deduplication or synchronization without building it.

## State models

Keep independent concepts in independent fields rather than one overloaded status:

- Revision review: `draft -> submitted -> changes_requested -> submitted -> approved` or `rejected`; pending submission may become `withdrawn`. Approved revisions are immutable.
- Listing publication: `unpublished | published | suspended | archived`, with an approved published-revision pointer.
- Event lifecycle: `scheduled | postponed | cancelled`; ongoing/ended are derived from the current approved dates and server time.
- Registration state: `confirmed | waitlisted | cancelled`. Attendance uses separate `checked_in_at` and check-in history, not a second confirmed registration.
- Registration availability is derived from publication, lifecycle, organizer status, opening/closing window, manual closure and capacity.
- Payment state, when added, is separate from registration and attendance.

Every mutation defines allowed previous state, next state, actor permissions, expected version, idempotency behavior, audit record and notification effects. Stale admin reviews cannot publish a newer unreviewed revision.

## Notion-style admin workspace

The owner's explicit Notion reference governs the layout. Reproduce the selected database screen closely using original code and existing accessible components. Do not use Notion branding/assets or pretend this is Notion. No full Notion block editor, AI tools, collaboration engine, arbitrary formula editor, or customizable database platform is needed.

### Layout and visual specification

- Collapsible pale-neutral left sidebar, approximately 240px on desktop: Fashley Admin, Events with nested working views, Organizers, Reports, Activity, Settings, Back to Fashley, account menu.
- Quiet top breadcrumb and compact page actions, white content canvas, generous title spacing, dense but readable property table. No hero, glow, gradients, statistic-card grid or decorative rules.
- Plus Jakarta Sans throughout. Neutral text, understated hover fills, compact rectangular controls and low-emphasis functional status tags. Table separators serve data reading, not decoration; confirm this limited exception to the owner's previous no-divider preference during visual approval.
- Event page heading, view tabs, search/filter/sort/property controls, New event action. Table rows open a right-hand detail panel; full-page action and deep-link support preserve back/forward behavior.
- Proposed admin dials: energy 1, rhythm 1, motion 1, because repeated moderation work needs predictable layout. Public event pages retain Fashley's warm paper/terracotta identity and image-led composition.
- Mobile sidebar becomes a drawer; review opens full screen. Present essential row information as a compact list rather than squeezing all desktop columns. Any desktop table scrolling is contained, not page overflow.
- Reuse existing Radix-based dialogs, menus, tabs and form controls. Evaluate 21st.dev patterns only where they genuinely match. Use Figma in the design phase to assemble the agreed screens and compare them with the selected Notion reference before implementation.

### Views and record editor

Saved working views: All events, Needs review, Changes requested, Published, Upcoming calendar, and Past/cancelled. Board view groups review state, not derived event lifecycle. Initial filters cover review/publication status, date, city, category and organizer; persisted personal view preferences must not change everyone's defaults.

Default columns: Event, Review, Publication, Start/timezone, City/format, Organizer, Confirmed/capacity, Submitted, Updated. Search and pagination run server-side. Column visibility and sorting are bounded supported settings, not an arbitrary query language.

Side peek tabs: Details, Registration settings, Attendees, Review history, Activity. Show public preview beside internal notes when space permits. Internal notes never enter public DTOs or organizer-facing messages.

Actions: Request changes, Reject, Approve and publish, Preview, Feature/unfeature, Close registration, Suspend/unpublish, Postpone, Cancel, Archive. Require a reason/confirmation for significant actions. Reviewer approves the exact revision shown. New event lets staff create a real listing with attributed organizer and source, not fabricate organizer ownership.

Bulk actions are deliberately limited initially to reviewer assignment, archiving eligible past listings, and non-public tagging. No bulk publish/cancel without per-record validation and an explicit confirmation showing impact. A board drag cannot bypass review, permission, notification or concurrency checks; use an action menu as a keyboard-accessible alternative.

Settings exposes only working controls. Staff permissions are platform-admin only. Do not build empty user/payment/shop management pages just to fill a sidebar; the shared shell can host those later.

## Architecture mapped to the current repository

Observed repository state: React/TanStack Start routes, Cloudflare Worker entrypoint, D1/R2/Images bindings, Clerk verification, and a separate tailor Workflow already exist. There is no current events module or app-wide admin authorization layer in the inspected source. Older implementation-status notes are historical, not proof of current deployment behavior.

Reuse the existing local identity mapping in `src/lib/tailor/server/identity.ts`: verified Clerk subject maps to `app_users` through `auth_identities`. Never relink accounts by email. Existing profile loading does not establish the new feature's verified-email requirement by itself; explicitly validate Clerk's email verification state for event actions.

Keep new business logic outside the tailor namespace:

```text
src/lib/events/contracts.ts
src/lib/events/server/{events,submissions,registrations,organizers,media,notifications,http}.ts
src/lib/events/client/
src/lib/admin/server/{authorization,audit}.ts
src/components/events/
src/components/admin/
src/styles/events.css
src/styles/admin.css
src/routes/events* / organizer* / organizers* / admin*
src/routes/api/events/ / api/organizer/ / api/admin/
workers/events-workflow/
```

Paths are proposed, not generated route filenames to copy literally. Match the router's current route conventions; regenerate `src/routeTree.gen.ts` through tooling, never manually.

Reuse the D1 adapter, verified actor, validated request/error patterns and suitable media checks. Extract small shared server utilities only when both callers need them; do not refactor the studio as part of events. Audit the existing receipt helper before reuse: separate check/write calls are not proof of concurrency-safe idempotency.

Use the current D1 binding with additive event/admin tables. The current migration chain is `migrations/tailor/0001` through `0005`; inspect the actual applied migration list before choosing the next numbers. Keep one ordered applied chain on this database, document that it now holds application modules, and do not introduce a competing untracked migration ledger or PostgreSQL migration.

Extend `src/server.ts` and `cloudflare.config.ts` with explicit event dependencies and, if selected, a scheduled outbox dispatcher. Preserve the SSR error wrapper, root footer, camera, private wardrobe, credits, payments and existing Workflow. Event notifications use a separate Workflow binding/worker, not tailor generation jobs. Do not provision additional paid infrastructure without approval.

### Data model

| Table                        | Essential contents / constraints                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organizers`                 | Stable ID, owner local user, public slug/name/bio, private operational contact, active/suspended status, version                                   |
| `organizer_members`          | Organizer/user/role membership; first release UI can be owner-only                                                                                 |
| `events`                     | Stable ID/slug, organizer, approved revision pointer, publication/lifecycle, registration closure, confirmed count/capacity, version               |
| `event_revisions`            | Immutable submitted content snapshot, IANA timezone and UTC start/end, registration-policy snapshot, author, review state/version, cover reference |
| `event_reviews`              | Exact revision, reviewer, decision, organizer-facing reason, internal note, timestamp                                                              |
| `event_media`                | Owner, object keys, MIME/size/dimensions, quarantine/approved state and publication reference                                                      |
| `event_questions`            | Bounded question definitions tied to a revision; answer validation and visibility                                                                  |
| `event_registrations`        | Unique event/user, state, verified contact snapshot, registered revision, question-version snapshot, timestamps, version                           |
| `event_registration_answers` | Registration/question snapshot and validated answers, private by default                                                                           |
| `event_tickets`              | Registration, hashed credential, issued/revoked timestamps; only one current valid credential                                                      |
| `event_check_ins`            | Event, registration, staff actor, check-in/undo action and timestamp                                                                               |
| `event_staff`                | Event-scoped check-in grants, grantor and revocation                                                                                               |
| `event_reports`              | Listing, reporter/contact where provided, reason, resolution and staff notes                                                                       |
| `platform_role_grants`       | Local user, allowed role, grantor, created/revoked timestamps                                                                                      |
| `admin_audit_log`            | Append-only actor/action/resource/revision/request ID and redacted change summary                                                                  |
| `event_notification_outbox`  | Unique business delivery key, recipient/reference, event schedule version, state, attempts, next attempt, provider ID/error                        |
| `event_mutation_receipts`    | Actor/operation/key uniqueness, request hash and committed response reference, expiry                                                              |

Merge tables where implementation proves the simpler shape preserves these invariants. This is not authorization to build a generic CMS. Reuse existing `mutation_receipts` instead of a new table only if it supports the required atomicity and actor scopes without changing existing callers.

Add indexes for published event dates/IDs, category/location, organizer ownership, review queue, event/state registrations, user registrations, and due outbox jobs. Add foreign keys, CHECK constraints and unique keys. Server-side pagination and bounded queries come before external search infrastructure. A basic title/organizer/city search is sufficient initially; measure before adding FTS or a search service.

### API surface

| Scope     | Representative endpoints                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public    | `GET /api/events`, `GET /api/events/:slug`, `GET /api/events/:id/calendar`, `GET /api/organizers/:slug`, `POST /api/events/:id/reports`                             |
| Attendee  | `POST /api/events/:id/registrations`, `GET /api/events/me/registrations`, own ticket/access, cancel, re-register, join/leave waitlist, resend notification          |
| Organizer | Profile create/update; own event list/create/draft/update/submit/withdraw; revision status; event attendees, promote, close/cancel/postpone; export with permission |
| Check-in  | Event-scoped ticket validation, check-in and undo, minimal attendee lookup                                                                                          |
| Admin     | Queue/list/detail; review exact revision; publish/suspend/feature/cancel; organizer actions; report resolution; audit; role grants; notification retry              |

Freeze request/response schemas before UI work, including public versus private DTO allowlists. All state-changing endpoints enforce authorization, validation and same-origin/CSRF protection for cookie authentication. Use idempotency keys for retriable mutations and expected versions for edits/reviews; return 409 with current version on conflict. Reject same key with different request content. Bound field lengths, question counts, upload sizes, pagination and bulk sizes.

Admin UI and future scripted operations use the same authorized endpoints. No action is available only through undocumented UI behavior or a browser-side database write.

## Media, security and privacy

- Keep existing R2 private. Store event uploads in a distinct namespace and quarantine them until validated and approved. Reuse MIME/dimension/metadata checks where suitable; verify actual image decoding rather than treating metadata stripping as malware scanning.
- Public cover endpoint serves only a current approved published event image. Draft originals, private wardrobe images, internal notes and attendee files are never made public. Do not make the bucket public for convenience.
- Use versioned public cover URLs and a bounded cache policy. On suspension/unpublish invalidate or stop serving relevant URLs; acknowledge that already downloaded public images cannot be recalled. Private responses use `no-store`.
- Render descriptions as sanitized bounded rich text or safe Markdown, not raw HTML. Validate links as HTTP(S); reject dangerous schemes. No server-side URL fetching/importing or arbitrary embeds at launch, which avoids an unnecessary SSRF surface.
- Apply server-verified bot protection and shared rate limits to submissions, registrations, reports, uploads and resend actions, with account/IP limits and understandable retry messages. Do not rely on per-isolate in-memory limits.
- Public responses use allowlisted fields, not `SELECT *` serialization. Attendee contact and answers are private. CSV export is permissioned, audited, formula-injection escaped, and downloaded through an expiring authorized route.
- Persist only necessary attendee data and separate optional marketing consent. Publish a retention/deletion policy and organizer obligations before launch. Data-access logs and cleanup must not copy answers or emails into audit metadata.
- Staff role revocation takes effect on subsequent authorization checks, not after an uncontrolled profile cache. Re-check active user/organizer status for writes and private reads.
- Validate registration and event state server-side even if the browser displays cached availability. Authenticated/private data never enters shared CDN caches or offline service-worker caches.
- Log request/resource IDs and bounded error codes. Do not log tokens, QR credentials, meeting URLs, full attendee answers or secret values. Return non-enumerating errors for inaccessible private records.

## Notifications and durable operations

Launch messages: submission receipt, changes requested, rejection/publication, registration/waitlist confirmation, promotion, attendee cancellation, event cancellation/postponement/material change, and one scheduled event reminder. Organizer seat-available notices are separate. Keep a message history/status in the relevant dashboards, not a new general-purpose social inbox.

Write the notification outbox in the same D1 transaction as the business mutation. A scheduled dispatcher claims due rows with leases and starts/advances durable delivery work. An immediate post-commit dispatch can reduce latency, but the scheduled recovery path is mandatory so a crash after commit cannot lose the message.

Use stable provider idempotency keys where supported. Workflow retries are not exactly-once email delivery: a crash after a provider accepts a message can otherwise cause duplicates. Bound retries, distinguish permanent failures, surface exhausted deliveries to admins, and provide audited retry/resend. Business success does not depend on the email provider being online.

Workflows support durable sleep/retry [S11], but date changes make old scheduled reminders stale. Version reminders by approved schedule, re-read current event/registration status immediately before sending, skip obsolete/cancelled jobs, and schedule new versioned work. Recheck private joining details when rendering messages. Batch fanout so cancellation of a large event does not exceed request/SQL/provider limits.

A transactional sending provider, domain verification, SPF/DKIM/DMARC configuration and bounce/suppression handling must be chosen and tested. Receiving mail through Cloudflare Email Routing does not provide a transactional sender. Do not claim `hello@fashley.app` works until delivery is verified.

## Paid-ticket release, if approved

Before implementation decide the merchant of record, supported country/currency, settlement recipient, platform fee, tax responsibility, organizer verification, refund policy, chargeback liability and support process. Confirm provider support for those requirements. Existing credit top-up behavior is not an event settlement system.

Required additions:

- Immutable order/line-item snapshots priced on the server in integer minor units; separate orders, payment attempts, ticket allocations, refunds and settlement records.
- Expiring capacity holds during checkout, authoritative server-side provider verification, signed/replay-safe webhooks, idempotent fulfillment and a reconciliation job.
- Never issue a paid ticket from a success redirect or client price. Handle late payment after hold expiry explicitly: fulfill only if a valid seat can still be reserved, otherwise queue refund/support resolution without overselling.
- Cancellation does not imply a refund completed. Refund and settlement state are separate; preserve the ledger and reconcile provider outcomes, duplicate/out-of-order webhooks and partial failures.
- Paid waitlists should invite an attendee to a time-limited held-seat checkout unless the selected provider's authorization/capture capabilities have been verified. Do not copy Luma's deferred-charge design onto an unsupported payment provider.
- Test real provider sandbox flows, payment failures, expired holds, disputes/refunds, reconciliation and staff permissions before enabling any production purchase.

Until this phase is approved and complete, show no native paid checkout or payout settings. If directory-only external paid events are allowed, disclose the external ticket seller and make no Fashley purchase/refund guarantee.

## Delivery sequence and approval gates

| Phase                                  | Deliverable                                                                                           | Exit evidence                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1. Product decisions and reference     | Confirm launch choices, policies, exact Notion reference screen, route map, wireframes                | Owner approval of scope and public/admin screens                                                 |
| 2. Identity, permissions and schema    | Additive migrations, server roles/bootstrap, contracts, lifecycle/capacity prototype                  | Auth/isolation tests and real D1 concurrency/rollback proof; no live data mutations              |
| 3. Admin and submission vertical slice | Working admin shell/table/side peek; organizer draft, submit, review, publish                         | One organizer submits and a separate authorized reviewer publishes the exact revision            |
| 4. Public directory and nav            | Search/filters, detail, organizer page, preview, metadata, shared navigation                          | Published event discoverable, drafts inaccessible; desktop/mobile nav and SEO verified           |
| 5. Registrations and operations        | Native RSVP, waitlist, tickets, My events, cancellation, organizer attendee tools and online check-in | Two-account isolation, last-seat race, duplicate click and invalid QR tests pass                 |
| 6. Delivery and moderation hardening   | Transactional email/outbox, reminders, revision changes, reports, exports, board/calendar views       | Provider outage/recovery, schedule changes, permission revocation and cancellation fanout tested |
| 7. Release                             | Staging review, approved real launch listings, production migration/deploy and smoke tests            | Owner go-ahead; documented rollback/feature-off path and evidence                                |
| 8. Paid ticketing                      | Only if approved, using the requirements above                                                        | Provider/financial/reconciliation gates passed before activation                                 |

Do not publicly expose a broken intermediate feature. Feature-gate directory, submissions and registration independently; keep all public entry points off until the corresponding full journey works. Nav launches with the directory, never as a dead link. Disabled registration must still let existing attendees access/cancel valid registrations.

During implementation, use short reviewable changes and the existing test/build commands. Do not rewrite published Git history. Deploy with `pnpm exec cf deploy` using the project-bound `fashley` profile, never Wrangler. Confirm profile/account and preserve publishable-key/binding configuration before an authorized deploy.

## Test and acceptance checklist

### Functional

- Visitor can browse/filter/share real published events; invalid URL filters fail safely and pagination has stable ordering.
- Organizer can draft, preview, submit, receive changes, resubmit and see publication/rejection status. Another organizer cannot read or edit the draft.
- Admin can work from the table and side peek, review the displayed revision, and inspect its history. Stale edits/reviews return conflicts, not silent overwrites.
- Published event remains unchanged while edits are pending. Schedule/location changes trigger a visible notice and versioned notifications after approval.
- Attendee registers, sees the same status after reload, gets a ticket, finds it in My events, cancels and re-registers safely.
- Capacity reached shows the correct full/waitlist state. Promotion cannot overbook. Registration windows are checked at the server, including at the exact closing boundary.
- Door staff can check in the correct event's confirmed ticket only; duplicates, cancelled tickets, wrong events and revoked staff access fail safely.
- Cancelled/postponed events stop new registration and obsolete reminders. Existing attendees can still inspect the current event notice.

### Data and security

- Test a burst of concurrent last-seat registrations and promotions against the actual D1 runtime, not only the in-memory test adapter. Confirm capacity, unique registrations, outbox and receipts remain consistent after injected failures.
- Duplicate/idempotent requests, same key/different body, timeout-after-commit, cancellation retries and concurrent review all behave deterministically.
- Test every role by calling endpoints directly, including anonymous/ordinary user against admin routes, cross-event attendee exports and staff role revocation.
- Verify public HTML/JSON/media/calendar contains no internal notes, email addresses, QR credentials, private meeting links or unapproved revision content.
- Malformed image, oversized body, script in description, malicious URL, CSV formula, report abuse and resend flooding are rejected or safely handled.
- Email provider outage leaves successful registrations intact; recovery sends pending messages without uncontrolled duplicates. Rescheduling suppresses old reminders.
- UTC/IANA conversion, ambiguous/nonexistent daylight-saving local times, multi-day dates and time-boundary filters are covered. Reject ambiguous input or require an explicit offset; never guess.

### UX and regression

- Every screen has loading, empty, validation, permission-denied, conflict and error states. Every visible control has a working action.
- Keyboard navigation, side-peek focus, Escape/return focus, screen-reader status messages, reduced motion, contrast, and 44px touch targets are checked.
- No page overflow at phone/tablet/desktop sizes; admin table overflow stays in its container. QR scanner has manual fallback and an honest online requirement.
- Existing homepage, studio generation/save, camera capture, wardrobe privacy, account flow, footer and credits retain their behavior.
- Run `pnpm run typecheck`, targeted/full tests, scoped lint and `pnpm run build`; record unrelated baseline failures rather than changing them silently.
- Record actual browser click-through evidence and screenshots against the approved Notion reference. Do not call the result pixel-exact without that comparison. Use the owner's chosen OpenCLI burner profile for authenticated browser QA when available.

## Launch and recovery

1. Recheck repository status, active deployment/configuration and applied D1 migrations. Take an authorized recoverable backup/checkpoint and test additive migrations on staging data.
2. Configure new bindings/secrets/scheduled work and verify email delivery. Bootstrap staff with explicit approval. Test a genuine event from submission through registration/cancellation/check-in on staging.
3. Prepare a small set of organizer-approved real listings and moderation coverage. No fabricated events or scraped republishing without rights/permission.
4. Apply additive production migrations, deploy compatible code with feature flags off, smoke-test authorized operations, then enable directory/submission/registration in order after approval.
5. Monitor registration conflicts, capacity invariants, moderation backlog, delivery failures, outbox age, check-in errors and request failures. Set operational alert thresholds from actual launch volume, not invented performance claims.
6. Recovery disables new submissions/registrations independently while preserving existing ticket/status access. Revert application deployment only if compatible with the additive schema. Do not drop tables, delete registrations, or undo financial records as a rollback.

Completion means a real organizer can submit, a real reviewer can publish, and a real attendee can register and attend, with the privacy, cancellation and operational paths working too. A directory page and a dashboard mockup alone do not satisfy this feature.

## Sources

- [S1: Luma, Creating an Event](https://help.luma.com/p/creating-an-event)
- [S2: Luma, Waitlist](https://help.luma.com/p/waitlist)
- [S3: Luma, Expanded Guest Table](https://help.luma.com/p/expanded-guest-table)
- [S4: Luma, Check In Guests](https://help.luma.com/p/check-in)
- [S5: Eventbrite, Create an event](https://support.eventbrite.com/hc/en-us/articles/34824366421522-Create-an-event)
- [S6: Eventbrite, Request a refund](https://www.eventbrite.com/help/en-us/articles/721549/can-i-get-a-refund/)
- [S7: eGotickets, Fashion Events in Ghana](https://egotickets.com/events?category%5B%5D=fashion-beauty&country=gh)
- [S8: Notion, Database views, filters, sorts and groups](https://www.notion.com/help/views-filters-and-sorts)
- [S9: Notion, Board view](https://www.notion.com/help/boards)
- [S10: Cloudflare D1, Database API and batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [S11: Cloudflare Workflows, Sleeping and retrying](https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/)

Cloudflare documentation was also retrieved through Context7. All competitor observations above are research inputs; Fashley's proposed behavior is explicitly specified rather than assumed to match provider internals.
