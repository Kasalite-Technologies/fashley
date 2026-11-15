# Events release notes

## Delivered scope

- Public SSR event directory, URL filters, event and organiser pages, navigation links.
- Verified-account event submission, immutable revisions, review decisions and publication.
- Free registration, manual waitlist promotion, opaque ticket codes, online check-in and cancellation.
- Notion-style admin database, side peek, reports, organiser moderation, staff grants and activity.
- D1 migration `0006_events.sql`, private R2 covers, durable notification outbox, optional Resend adapter.

Not delivered: paid tickets, QR encoding, assigned door-staff management, offline admission, automated reminders, attendee exports, unrestricted event editing by staff, or category administration. Notification dispatch is a manual platform-admin operation, not a scheduled job.

## Review corrections

- Capacity counters follow database row transitions; cancellation, re-registration and promotion use optimistic version guards. Promotion notifications now share the ticket transaction.
- Registration windows apply to waitlisted people as well as confirmed attendees. Capacity reductions cannot invalidate confirmed seats.
- Review requests carry the revision ID the editor saw. Database guards reject a second decision, a stale revision, and publication by a suspended organiser.
- Live snapshots remain approved snapshots even while a suspended listing is edited. Cover uploads cannot modify approved or submitted revisions; previews use authenticated revision URLs.
- Only explicitly verified emails enter the staff lookup table. Ambiguous account matches are rejected. Last-admin protection is enforced in SQLite, not just a preflight count.
- Cookie-authenticated mutations reject cross-site origins. Private query caches reset when the signed-in account changes.
- The registrations list returns confirmed attendees' access details. Cover URLs now match the actual API route. Notification dispatch leases rows and bounds provider calls.

## Validation

### Anonymous report abuse control

The report POST now consumes a D1-backed quota before parsing the body or looking up an event: five attempts per Cloudflare caller IP per ten minutes, shared across event slugs and Worker instances. A conditional UPSERT enforces the quota atomically; excess requests return `429 RATE_LIMITED`. Missing caller identity returns `503` rather than falling back to client-controlled forwarded headers. Only a SHA-256-derived bucket identifier is stored, not the raw IP. Expired buckets are removed in indexed batches of at most 100 on incoming report attempts; cleanup is traffic-driven, not a scheduled retention guarantee. This is per-caller containment, not protection against distributed abuse.

Before deploying this fix, apply additive migration `0007_event_report_rate_limits.sql` to the Events D1 database with owner approval. The SQLite-backed HTTP regression tests cover concurrent bursts, cross-slug/email/header bypass attempts, separate callers, exact expiry, invalid requests, missing identity, and bounded counter cleanup. Use CI as the validation gate; these tests were not executed in the local credential-bearing workspace.

Earlier development runs passed the Events tests, typecheck and production build, with a stale unrelated brand-label test failing in the full suite. That assertion is updated to the existing brand label in a separate commit.

The review corrections add regression coverage for stale cancellations, waitlist closure, capacity reductions, duplicate reviews, revision-bound HTTP decisions, approved-cover immutability, explicit verification and cross-site mutations. Final validation is the PR's Node 24 CI matrix (`test`, `typecheck`, `lint`, `build`). Earlier results do not validate the review corrections.

This pass did not rerun target tests in the local credential-bearing workspace: the security review requires OS-enforced network/filesystem/environment isolation that is not available here. No live security probes were performed. CI is the ordinary project validation gate, not a claim that a full sandboxed security audit ran.

## Before enabling Events in production

1. Obtain owner approval before applying `0006_events.sql` to production D1. It is additive and does not migrate historical identities, wallets or payments. Do not copy local QA databases or seed records.
2. Bootstrap the first platform-admin grant using a verified Clerk subject's existing local user ID, never an email-based identity relink. Record the grant in the audit log.
3. Configure the transactional sender and verified sending domain, or explicitly accept queued, undelivered notifications. Test dispatch, retries and provider idempotency.
4. Smoke-test with genuine verified attendee, organiser and staff sessions: submit, request changes, publish, register, waitlist, cancel, promote and check in. The previous browser QA used fixtures for the admin table, not a genuine staff session.
5. Approve moderation ownership, retention and support policies. Review public-report abuse controls and image metadata handling before public launch.
6. Deploy only through `pnpm exec cf deploy` with the approved profile. Merging this PR is not permission to migrate production data or deploy.

If the deployed application must be rolled back, roll back the Worker code and retain the additive Events tables. Never drop attendee, ticket or audit records as a rollback shortcut.
