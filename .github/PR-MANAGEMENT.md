# Pull request management and Git rules

These rules apply to every agent and human working on Fashley. They are process rules, not a claim that GitHub branch protection is enabled.

## Branches

- `main` is the integration branch. No direct commits or pushes to `main`.
- All work happens on a short-lived branch from current `main`:
  - `feat/<scope>` for features, `fix/<scope>` for fixes, `docs/<scope>` for documentation, `chore/<scope>` for tooling.
  - One burst of work per branch or per well-separated commit series on an agreed feature branch.
- Keep branches scoped. Backend, frontend, and orchestrator work uses separate commits even when it shares one feature branch.
- Rebase, amend, squash, force-push, `reset --hard`, `clean -f`, stash drop, and branch deletion are forbidden on pushed branches unless the repository owner explicitly authorizes that exact operation.
- Never pass `--delete-branch` to `gh pr merge` or any other command.
- Ask the owner before closing or deleting any branch, pull request, issue, or remote ref, and before merging a pull request.

## Bursts

Work is delivered in bursts so any session can be compacted and resumed:

1. State the burst scope and the files it owns before editing.
2. Implement only that scope. Park unrelated findings in the handoff, do not fix them opportunistically.
3. Run the checks listed in the pull request template and record real results.
4. Commit with a scoped message, push the branch, and update the draft pull request body with the burst handoff.
5. Stop at the burst boundary. The handoff must let a fresh session resume without chat history: completed, files changed, tests run, blocked, next burst.

Local planning and agent files under `hackathon/`, `.agents/`, `.opencode/`, and `.claude/` are git-ignored and stay out of pull requests. Burst handoffs therefore also live in the pull request body.

## Commits

- Format: `type(scope): summary`, for example `feat(tailor): add G0 contracts`, `docs(github): add PR rules`.
- One concern per commit. Contracts, backend, frontend, and integration work are separate commits.
- Do not commit secrets, `.env` values, credentials, local skills, or agent configuration.
- Do not rewrite a commit that has been pushed.

## Pull requests

- Open as draft. One pull request per feature branch, targeting `main`.
- The body must contain: objective, burst log, files changed, contract changes, tests actually run with results, security and privacy notes, blocked or not implemented items, and remaining risks.
- Every pull request needs CI results for test, typecheck, lint, and build. Pre-existing failures must be named as pre-existing with evidence, not hidden or suppressed.
- Review: orchestrator reviews contract and integration changes, backend reviews API and data changes, frontend reviews UI and accessibility changes. A reviewer who wrote the code does not mark their own burst verified.
- Ready for review only when the burst log is complete and no dead controls, fixture fallbacks in production paths, or unverified claims remain.
- Merge requires explicit owner approval. No auto-merge. No branch deletion after merge without separate owner approval.

## Agent ownership

| Area | Owner |
| --- | --- |
| `src/lib/tailor/contracts/`, fixtures, integration tests, `package.json`, lockfile, Vite/PWA/root config | Orchestrator (Agent C) |
| `migrations/tailor/`, `src/lib/tailor/server/`, `src/routes/api/tailor/` | Backend (Agent A) |
| `src/components/tailor/`, `src/lib/tailor/client/`, `src/routes/tailor*`, `src/routes/review*` | Frontend (Agent B) |

An agent that needs a file outside its ownership writes a boundary-change request in the pull request instead of editing it. Shared contract changes update schemas, fixtures, docs, and consumers in the same burst.

## Safety

- No production deployment, live account migration, purchase, payment change, or destructive data operation from a coding burst without separate owner authorization.
- Legacy Supabase and PostgreSQL Drizzle source is preserved until a verified replacement exists. Never delete or relink historical identities, designs, credits, or payments by email.
- Report unverified items as blocked. A fixture, mock, or local test is never described as live provider or deployment proof.
