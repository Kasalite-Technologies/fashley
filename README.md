# Fashley

Turn fabric into garment concepts, capture measurements, and prepare a versioned brief for tailor review.

## Target stack

- React and TanStack Start for the application.
- Cloudflare Workers for hosting and APIs.
- Cloudflare D1 for application data.
- Clerk for authentication.
- Private Cloudflare R2 storage for media.
- Cloudflare Workflows for durable jobs.
- Meta Model API for model inference.
- Vercel Geist as the strict design system.

Supabase is not the target stack. This repository currently contains an imported application with legacy Supabase integrations, PostgreSQL Drizzle schemas/migrations, and Lovable tooling. Their replacement has not been implemented yet. Do not treat those integrations as the new setup or run the old migrations against D1.

The new Clerk/D1/R2 workflow is not yet runnable. Historical accounts, private designs, credits, and payments require an explicit, verified migration; they must not be silently moved or discarded.

## Development

Use Node.js 24 and Bun 1.3.14.

```sh
git clone https://github.com/Kasalite-Technologies/fashley.git
cd fashley
bun install --frozen-lockfile
```

`.env.example` records the target configuration boundaries, not a working runtime configuration. Clerk, Worker bindings, model credentials, and local development wiring will be documented when implemented. The existing `bun run dev` command still starts the legacy application and does not prove the target stack works.

Never commit credentials, local environment files, or customer data. Local skills, agent configuration, editor metadata, and planning documents are ignored.

## Checks

```sh
bun run test
bun run typecheck
bun run lint
bun run build
```

GitHub Actions runs these independently on pushes to `main`, pull requests, and manual dispatches. It currently checks the imported source, not a completed migration. It does not deploy, provision resources, or run remote migrations. Existing lint failures remain visible. See [CI notes](.github/CI.md).
