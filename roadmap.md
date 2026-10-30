## Copywriting pass
- [x] Review every page, shared control, metadata, message and legal page; change text only.
- [x] Inspect available email templates: no custom email templates exist in the project.
- [ ] Rewrite built-in auth email templates: custom templates and a verified sender domain are needed; do not change email infrastructure during a text-only pass.
- [x] Verify source and rendered public pages contain no user-facing em or en dashes; all 19 tests pass.

## Launch readiness
- [x] Add footer, legal/contact/about pages, share metadata and friendly 404.
- [x] Update sign-up consent, eight-character password rules and recovery pages; verify reset requests succeed and expired links are rejected.
- [x] Add mobile navigation and verify public and signed-in pages at 375px.
- [x] Add signed-out design previews and illustrated Discover cards.
- [x] Store shop notification requests and improve empty cart.
- [x] Improve generation progress, retry, WhatsApp sharing and downloads.
- [x] Run 19 tests; verify real generation, download and sharing, notification save response and mobile interactions.
- [ ] Verify inbox delivery and complete a password change through a real emailed recovery link — requires access to the recipient’s inbox.
- [ ] Add social profile links — owner chose to omit them until real profile URLs are provided.


## Shoe and bag design
- [x] Add home sections and dedicated shoe/bag studios.
- [x] Support material uploads, preferences, generation, detail, download and saving.
- [x] Verify signed-in generation and saved designs, plus mobile layout.

## Fabric-photo flow checks
- [x] Test shoe and bag generation with patterned fabric, downloads, saves and preference changes.
- [x] Fix confirmed issues and add regression coverage.
- [x] Recheck affected flows and remove test-only saved designs.
- [x] Link shoe and bag design sections and studios to Pinterest inspiration.

## Animated style video
- [x] Produce a wide animated video showing Ghanaian outfit styles.
- [x] Place it on the home page and verify it plays there.
- [x] Remove the generated video and its "Styles in motion" section from the home page at the user's request. Do not re-add it.

## FASHLEY Coins
- [x] Enforce three free image generations and atomic coin deductions.
- [x] Show balance, generation costs and configurable 10/30/75 coin packages.
- [x] Add role-secured package pricing administration.
- [x] Connect Paystack checkout and idempotent server-verified payment crediting; verify credentials and keep purchases disabled.
- [x] Verify free generation end-to-end, pricing controls, payment matching safeguards and phone layout.
- [x] Set package prices: 10 coins for GH₵20, 30 coins for GH₵25, and 75 coins for GH₵30.
- [ ] Accept and verify an actual coin purchase — owner must publish and configure Paystack webhook at https://fashley.lovable.app/api/public/paystack before opening purchases.

## Brand name
- [x] Rename Fashio to Fashley in the header wordmark, page titles, descriptions, alt text, the shop heading and saved design file names. Keep the store's technical address unchanged.