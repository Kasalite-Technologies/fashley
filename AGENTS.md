<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Outfit, shoe and bag routes reuse the same Studio with a design-kind prop, so uploads, generation and private saves behave consistently.
- Design options live in a browser-safe shared module; generation prompts are assembled server-side from validated preferences to keep AI instructions out of the client.
- Generated results carry immutable preference snapshots; detail labels and saved metadata derive from those snapshots, not editable controls, to avoid mislabeling designs.
- Pinterest inspiration uses a shared external-link control with encoded search preferences and opens in a new tab, keeping the design session intact.
- Coin quotas and charges are enforced with service-only atomic database functions around the shared image endpoint; clients only display quotes and cannot credit wallets.
- Paystack top-ups use server-priced purchase snapshots and idempotent fulfillment after server verification; package editing requires a server-validated admin role.

- Mount the shared footer at the root so every content page has the same legal and contact links.
- Auth mode uses validated search parameters so sign-up and password-recovery titles remain route-managed.
- Shop notification requests use insert-only public access with database validation; email addresses are never publicly readable.
- Signed-out design surfaces reuse illustrative preview assets and a shared preview to avoid exposing private designs.
- PWA: vite-plugin-pwa generateSW at /sw.js, registered only via src/lib/pwa-register.ts (guards dev/iframe/preview) so previews never get stale caches.
