# 03 — Shared API contracts

**Contract version:** 1. Shared Zod 3 runtime schemas and inferred TypeScript types belong in `src/lib/tailor/contracts/`. This specification defines application HTTP APIs, **not** unverified Meta request syntax. API paths below are canonical; router filenames may differ.

## Common transport rules

- JSON success: `{ data: T, requestId: string }`. Error: `{ error: { code, message, retryable, fieldErrors?: Record<string,string[]>, currentVersion?: number }, requestId }`.
- `Content-Type: application/json`; private responses including errors use `Cache-Control: no-store`. Asset responses are binary and carry request ID as a header. No raw R2 key, upstream URL, token hash, SQL error or provider response body in DTOs.
- Owner identity = validated Clerk session → stable internal user ID. Reject inactive users. Cross-owner resource requests return `404 NOT_FOUND`; unauthenticated requests return `401 UNAUTHENTICATED`.
- Same-origin cookie mutations require validated Origin/CSRF protection, including JSON API handlers; existing server-function CSRF middleware alone is insufficient. Review actions use a scoped HttpOnly session with equivalent protections.
- All list APIs use opaque validated cursor and `limit` 1–50 (default 20); response `{items, nextCursor: string|null}`. Stable `(createdAt,id)` ordering except project list `(updatedAt,id)`.
- `Idempotency-Key` required on mutations labelled **I** below: 16–128 allowed ASCII characters, scoped to actor+operation. Exact replay returns prior resource; changed normalized payload returns `409 IDEMPOTENCY_CONFLICT`. Jobs also bind the key to job type/project/revision hash.
- Optimistic versions are integers >=1. Stale draft, freeze or finalization/action returns `409 REVISION_CONFLICT`; do not overwrite changes silently.
- Standard statuses: `200` read/update/replay, `201` created, `202` durable work/deletion accepted, `400` malformed, `401`, `404`, `409`, `410` expired/revoked review credential, `413` too large, `415` unsupported media, `422` domain validation, `429` throttled with `Retry-After`, `503` temporarily unavailable.
- Error code union: `UNAUTHENTICATED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_INPUT`, `REVISION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `CONSENT_REQUIRED`, `UPLOAD_REJECTED`, `ASSET_NOT_READY`, `MISSING_MEASUREMENTS`, `FABRIC_UNKNOWN`, `FABRIC_INSUFFICIENT`, `BRIEF_BLOCKED`, `BUDGET_EXCEEDED`, `PROVIDER_UNAVAILABLE`, `AMBIGUOUS_PROVIDER_RESULT`, `JOB_NOT_RETRYABLE`, `SHARE_EXPIRED`, `SHARE_REVOKED`, `INVALID_REVIEW_CREDENTIAL`, `RATE_LIMITED`, `FEATURE_UNAVAILABLE`.

## Core response DTOs

```ts
type ConstraintResult = {
  status: 'sufficient'|'insufficient'|'unknown';
  rule: { templateId: string; version: number; ruleVersion: string } | null;
  availableLengthMm: number | null;
  requiredLengthMm: number | null;
  assumptions: string[];
  reasons: { code: string; message: string; fieldPath?: string }[];
};
type Blocker = { code: string; message: string; fieldPath?: string;
  blocks: ('concept'|'finalize'|'accept')[] };
type Job = {
  id: string; projectId: string; revisionId: string;
  type: 'analyze_fabric'|'generate_concept'|'assemble_brief';
  state: 'queued'|'running'|'retry_wait'|'needs_attention'|'completed'|'failed'|'cancelled';
  stage: 'validating'|'segmenting'|'understanding'|'generating'|'assembling'|'persisting'|null;
  attemptCount: number; createdAt: string; updatedAt: string;
  retryAfterMs: number | null; result: JobResult | null;
  error: { code: string; message: string; retryable: boolean } | null;
};
type Asset = { id: string; projectId: string;
  kind: string; mime: 'image/jpeg'|'image/png'|'image/webp';
  bytes: number; widthPx: number; heightPx: number;
  parentAssetId: string | null; createdAt: string };
// Asset URLs are derived same-origin authorized endpoints, not public bucket URLs.
type Brief = {
  id: string; projectId: string; revisionId: string; briefNumber: number;
  state: 'draft'|'finalized'|'superseded'; contentHash: string;
  createdAt: string; finalizedAt: string | null;
  content: BriefContent; assets: Asset[]; blockers: Blocker[];
  review: { status: 'awaiting_review'|'changes_requested'|'design_approved'|'accepted';
    requiredMeasurementCount: number; verifiedMeasurementCount: number;
    actions: ReviewAction[] };
};
```

`JobResult` is a discriminator union keyed by job type, not an untyped blob:

- `analyze_fabric`: `{type, sourceAssetId, segmentation:{status:'completed'|'failed', regions: {id, maskAssetId, bbox:{x,y,width,height}}[], errorCode:string|null}, observations:{key,value,uncertainty:'observed'|'uncertain'}[]}`. Bounding boxes normalized 0–1; zero regions is not successful selection. Spark failure may give empty observations with warning, not invented facts.
- `generate_concept`: `{type, asset:Asset, inputSnapshot:ProjectInput, modelId, promptVersion, providerRequestId:string|null, warnings:string[]}`.
- `assemble_brief`: `{type, briefId:string}`.

`BriefContent`: `{schemaVersion:1, title, template:{id,version,name}, inputSnapshot:ProjectInput, conceptAssetId, fabricAssetId, measurements:MeasurementView[], constraint:ConstraintResult, materials:{label,quantity:string|null,source:'user'|'template'}[], decisions:string[], assumptions:string[], questions:{id,text,required:boolean,resolved:boolean,source:'user'|'template'|'agent'}[], provenance:{modelIds:string[],promptVersion:string,ruleVersion:string|null}, disclaimer:string}`. Agent-generated material quantities must be null unless backed by structured input/rule. Agent cannot mark required questions resolved without supporting facts.

`MeasurementView`: snapshot fields plus `id`, `verification:{status:'unverified'|'verified', actorName:string|null, method:string|null, verifiedAt:string|null}`. Reviewer responses omit this entire array when grant excludes measurements; they must not leak it through snapshot/questions/blockers/tool traces either.

## Session, configuration and templates

| Method/path | Request | Response / behavior |
| --- | --- | --- |
| `GET /api/tailor/me` | — | `{user:{id,displayName,email},preferences:{measurementUnit,timezone,version},credits:{available,reserved},capabilities:{personUpload:boolean,manualCrop:boolean},policy:{version,personRetentionDays},jobQuotes:{analyze_fabric:number,generate_concept:number,assemble_brief:number}}`; no sensitive legacy mappings |
| `PATCH /api/tailor/me/preferences` | `{expectedVersion,measurementUnit:'cm'|'in',timezone}` | Updated preference DTO |
| `GET /api/tailor/templates` | `?limit&cursor` | Published template summaries only; no fake garment catalogue |
| `GET /api/tailor/templates/:id?version=N` | Exact version optional for latest published | Template options, measurement labels/guidance and supported domain. Server evaluates rules; no system prompts in DTO. |
| `GET /api/tailor/consents` | — | Owner consent summaries with scope and withdrawal status |
| `POST /api/tailor/consents` **I** | `{purpose,policyVersion,projectId?,assetIds?:string[]}` | `201 Consent`; server validates scope. Fabric/person consent may be project-purpose scope before asset exists; associate accepted asset at completion. |
| `POST /api/tailor/consents/:id/withdraw` **I** | `{}` | `{consent,cleanupScheduled:boolean}`; revoke dependent grants, block further processing, schedule appropriate media cleanup, explain retained exported copies |

## Projects and versioned intake

| Method/path | Request | Response / behavior |
| --- | --- | --- |
| `GET /api/tailor/projects` | `?query=&status=all\|active\|archived&reviewStatus=&cursor=&limit=` | Summaries `{id,title,templateName,thumbnailAssetId:null|string,status,reviewStatus,currentRevisionNumber:null|number,updatedAt}`; parameterized search max 100 characters |
| `POST /api/tailor/projects` **I** | `{title,template:{id,version},occasion:null|string,deadline:null|string,fit,timezone}` | `201 ProjectDetail`, initializes draft; no paid work starts |
| `GET /api/tailor/projects/:id` | — | `ProjectDetail={project:{id,title,status,version,currentRevisionId,latestBriefId,updatedAt},draft:{version,baseRevisionId,input:ProjectInput},currentRevision:null|Revision,latestJob:null|Job,latestBriefSummary:null|BriefSummary}` |
| `PATCH /api/tailor/projects/:id/draft` | `{expectedDraftVersion,input:ProjectInput}` | `{draftVersion,projectVersion,savedAt}`; full snapshot replacement, validated incomplete draft; dirty fields are not merged by server |
| `POST /api/tailor/projects/:id/revisions` **I** | `{expectedDraftVersion,expectedProjectVersion}` | `201 {revision:Revision,projectVersion}` or `200` identical hash reuse. `Revision={id,projectId,number,input,inputHash,createdAt}` |
| `GET /api/tailor/projects/:id/revisions/:revisionId` | — | Exact immutable revision owned by project |
| `POST /api/tailor/projects/:id/archive` **I** | `{expectedProjectVersion,archived:boolean}` | Updated project metadata; no media deletion |
| `GET /api/tailor/projects/:id/history` | `?cursor&limit` | Timeline union `{kind:'revision'|'brief'|'review'|'job',id,createdAt,summary,revisionId?,briefId?,status?}`; safe human-readable summaries, no raw prompts |
| `DELETE /api/tailor/projects/:id` **I** | `{expectedProjectVersion}` | `202 {projectId,status:'deleting',cleanupId}`; revoke shares, tombstone access and cancel publication first |

Draft saves increment project version as well as draft version to maintain list ordering/concurrency. The frontend uses the returned versions before freezing. Reopening a historical revision never changes the current draft; “Use as new draft” is an explicit full draft-save action with current version checks, followed by new revision on freeze.

## Private upload and selection

P0 uses same-origin **Worker-mediated binary uploads**, avoiding browser R2 credentials/presigning complexity. Quarantine bytes are never valid model input. Implement decoded validation/sanitization in an actually supported runtime; a deployable sanitation service is an explicit G1 dependency, not imaginary Node support.

| Method/path | Request | Response / behavior |
| --- | --- | --- |
| `POST /api/tailor/projects/:id/uploads` **I** | `{kind:'fabric_source'|'person_source',mime,bytes,consentId}` | `201 {uploadId,putUrl:'/api/tailor/projects/.../uploads/.../content',expiresAt,maxBytes:10485760}` |
| `PUT /api/tailor/projects/:id/uploads/:uploadId/content` | Raw bytes; declared content type | `200 {uploadId,status:'received'}`; authenticated, scoped, streamed byte cap. Replay only before validation and with matching digest, else conflict. |
| `POST /api/tailor/projects/:id/uploads/:uploadId/complete` **I** | `{}` | `202 {uploadId,status:'validating'}` or `200 {uploadId,status:'ready',asset}` if already complete. Sanitation is a durable internal task. |
| `GET /api/tailor/projects/:id/uploads/:uploadId` | — | `{uploadId,status,asset:Asset|null,error:null|{code,message}}`; polling until ready/rejected/expired |
| `GET /api/tailor/assets/:id` | Owner session | Binary sanitized asset, private/no-store; deny before ready, after withdrawal/deletion |
| `POST /api/tailor/projects/:id/fabric-selection` **I** | `{sourceAssetId,method:'sam',analysisJobId,regionId}` OR `{sourceAssetId,method:'manual_crop',crop:{x,y,width,height}}` | `201 {selection:ProjectInput['fabric']['selection'],asset:Asset}`. Verify region lineage; server creates actual crop from sanitized original. Manual crop coordinates normalized 0–1 and bounded. Does not auto-save draft; caller saves returned selection with expected version. |

## Jobs, constraints and briefs

| Method/path | Request | Response / behavior |
| --- | --- | --- |
| `POST /api/tailor/projects/:id/jobs` **I** | `{type:'analyze_fabric'|'generate_concept',revisionId}` | `202 {job:Job,credits:{reserved:number}}`; server validates frozen inputs/consents/quote. Paid job never starts implicitly from GET/navigation. |
| `GET /api/tailor/jobs/:id` | — | `Job`; same owner check including current project tombstone |
| `POST /api/tailor/jobs/:id/cancel` **I** | `{}` | `202 Job`; best-effort provider cancellation, guaranteed no later publication once cancelled |
| `POST /api/tailor/jobs/:id/retry` **I** | `{acknowledgePossibleProviderCost?:boolean}` | `202 Job` only for a retryable `retry_wait`/`needs_attention` job with a held reservation and unexpired deadline; reset only safe incomplete steps. Require acknowledgement for unrecoverable ambiguous outcomes. Terminal failed/cancelled/released jobs return `409 JOB_NOT_RETRYABLE`; deliberate restart uses the original start endpoint with a new key/quote/reservation. |
| `POST /api/tailor/projects/:id/checks` | `{revisionId}` | `{constraint:ConstraintResult,missingMeasurements:string[],unverifiedMeasurements:string[],blockers:Blocker[]}`; deterministic, free, no model call |
| `POST /api/tailor/projects/:id/briefs` **I** | `{revisionId}` | `202 {job:Job}` of type `assemble_brief`; reuses selected persisted concept, no second image generation |
| `GET /api/tailor/briefs/:id` | — | `Brief` including owner review summary |
| `POST /api/tailor/briefs/:id/finalize` **I** | `{expectedProjectVersion,expectedContentHash,acknowledgedBlockerCodes:string[]}` | `{brief:Brief,projectVersion}`; exact content frozen, older finalized brief superseded/grants revoked. Missing mandatory structure prevents finalize; unresolved production facts may finalize with warning but block accept. |
| `GET /api/tailor/briefs/:id/shares` | Owner | Active/expired/revoked grant summaries; no raw token/PIN |
| `POST /api/tailor/briefs/:id/shares` **I** | `{expectedContentHash,expiresInHours:1|6|24,includeMeasurements:boolean,permittedAssetIds:string[],actions:('request_changes'|'approve_design'|'verify_measurements'|'accept_brief')[],pin?:string,consentId}` | `201 {grant:{id,expiresAt,...},reviewUrl:string}`; >128-bit random token; body never logged. Reject verification/accept actions if measurements excluded; original person image excluded unless explicitly selected and consented. |
| `POST /api/tailor/shares/:id/revoke` **I** | `{}` | `{id,revokedAt}`; primary-consistent revocation enforced for sessions/media/actions immediately |

Raw review tokens are not stored. A repeated share-create request returns `200 {grant,reviewUrl:null,linkAlreadyIssued:true}` instead of creating another grant or pretending to recover the secret. UI retains the original response only in component memory; after refresh user can revoke and create a new link. Network-loss messaging explains this. No raw review URL in localStorage, query cache persistence or mutation receipts.

## Restricted reviewer API

| Method/path | Request | Response / behavior |
| --- | --- | --- |
| `POST /api/tailor/review/exchange` | `{token,pin?:string}` + Origin/CSRF validation | `200 {briefId,expiresAt}` and Secure/HttpOnly/SameSite review-session cookie scoped `/api/tailor/review`; invalid/PIN-missing gives generic credential error. Rate-limit failed and successful exchanges. No private brief returned yet. |
| `GET /api/tailor/review/session` | Review cookie | `{grant:{id,expiresAt,actions,includeMeasurements},brief:RedactedBrief,capabilities:{canApprove,canVerify,canAccept,blockingReasons},reviewerIdentity:{method,verified:false}}` |
| `GET /api/tailor/review/assets/:id` | Review cookie | Only granted asset; no owner endpoint reuse or object-key access |
| `POST /api/tailor/review/actions` **I** | `{briefId,expectedContentHash,action,reviewerName,note?,verifications?:{measurementId,valueMm,method:'in_person_tape'|'reviewed_record'}[]}` | `201 {action:ReviewAction,review:ReviewSummary,capabilities}`; authoritative precondition check in transaction, stale/superseded/change-requested approval returns `409` |
| `POST /api/tailor/review/logout` | `{}` | `200 {ok:true}` and clears cookie/session |

`ReviewAction={id,briefId,action,reviewerName,credentialType,identityVerified:boolean,note:string|null,createdAt}`. Name 1–100 chars; change request note required 1–2,000 chars; other note max 2,000. Verification requires at least one listed measurement and exact same-brief value, no photo estimate. Acceptance cannot be enabled by client flags. No authenticated-identity badge for P0 link/PIN users.

`RedactedBrief` is a **separate allowlist schema**, not `Omit<Brief,...>` over arbitrary content. Strip measurement fields, measurement-related free text, person references and owner IDs unless specifically authorized. P0 should omit all unrestricted free-text sections when measurements are not shared rather than attempt unreliable text redaction. Return a visible list of omitted sections. Do not expose owner history, jobs, audit events or internal provenance traces.

The entry `/review/$token` must never auto-consume a grant or approve anything on GET (messaging preview bots may visit). User presses “Open secure brief”, optionally enters PIN, client exchanges token, then calls `history.replaceState`/router replace to `/review` **before fetching content**. Disable route prefetch and telemetry for token routes. An existing review session is one grant per browser session; opening another link explicitly replaces it and explains which brief is active.

## Example mutation and conflict

```json
POST /api/tailor/projects/prj_example/revisions
Idempotency-Key: freeze-8b9c1e5c-example
{"expectedDraftVersion":4,"expectedProjectVersion":5}
```

```json
{"error":{"code":"REVISION_CONFLICT","message":"This project changed. Reload the latest saved draft before continuing.","retryable":false,"currentVersion":6},"requestId":"req_example"}
```

Do not silently retry that mutation with a newly fetched version and overwrite another editor. The UI offers reload and preserves the unsaved in-memory values for comparison/copy.
