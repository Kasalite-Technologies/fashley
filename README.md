# Fashley

Fabric-based outfit concepts built with React, TanStack Start and Supabase.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://fashley.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/dd47c729-9f6f-4fb0-8073-c5c54e249b8d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- This repository starts from a local source export. Its connection to Lovable must be configured separately; creating the repository does not automatically connect it to the editor or deploy it.
- Preserve published history when working with Lovable; do not force-push or rewrite pushed commits.

## Development

Use Node.js 24 and Bun 1.3.14. Keep the existing `bun.lock` and `bunfig.toml` dependency and supply-chain settings.

```sh
git clone https://github.com/Kasalite-Technologies/fashley.git
cd fashley
bun install --frozen-lockfile
cp .env.example .env
# Fill in the existing Supabase project's public configuration.
bun run dev
```

Never commit `.env`, service-role keys, provider credentials or customer data. The example contains placeholders only; server-side integrations require their own securely configured credentials.

## Continuous integration

GitHub Actions runs the following independent checks on pushes to `main`, pull requests and manual dispatches:

```sh
bun run test
bun run typecheck
bun run lint
bun run build
```

The workflow uses a frozen Bun lockfile, SHA-pinned actions and read-only repository permissions. It does not deploy, provision Cloudflare resources, run remote database migrations or require production credentials. Failed checks are reported, not suppressed; existing lint debt may need a separate cleanup.

## Planning documents

`hackathon/` contains future product plans and agent task sheets. They are not a description of the currently deployed infrastructure. The existing Supabase/Lovable application is retained by this repository setup.
