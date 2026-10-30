# Continuous integration

This workflow checks the existing Supabase/Lovable application. It does not implement the future architecture in the hackathon plans.

- Events: push to `main`, pull request, manual dispatch.
- Runtime: Ubuntu 24.04, Node.js 24, Bun 1.3.14.
- Dependencies: existing `bun.lock`, installed with `--frozen-lockfile`; existing `bunfig.toml` supply-chain settings remain unchanged.
- Independent required-to-pass workflow jobs: tests, TypeScript, ESLint and production build. Failure of one job does not cancel the others.
- Security: SHA-pinned actions, read-only `contents` permission, no persisted checkout credentials, no production secrets or deploy steps. This workflow alone does not enforce branch protection.

## Initial source baseline

Before CI setup, a local ESLint check found 1,145 errors: 1,143 formatting errors and two Rules of Hooks errors. There were also six Fast Refresh warnings. These are not suppressed by CI. Fixing that existing application debt is separate from repository setup; expect the lint check to fail until it is addressed.

Initial tests and TypeScript checks passed locally after resolving the manifest with pnpm during investigation. The project remains Bun-managed: that temporary pnpm lockfile was removed, and CI uses the committed Bun lockfile. Those investigation results are not a substitute for the actual GitHub Actions results with Bun.

No original Git history was present in the supplied folder. The initial commit records a source import, not the app's original creation date. Connecting this new repository back to Lovable requires separate configuration.
