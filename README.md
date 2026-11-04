# Fashley

See what you could make with your fabric.

[Open Fashley](https://fashley.app)

Fashley turns fabric photos into outfit, shoe and bag concepts. Upload a fabric you own, choose a design and style, and compare the results before deciding what to make. You can add an optional description to request details such as long sleeves, a particular neckline or a relaxed fit.

## Using Fashley

1. Open the outfit, shoe or bag studio and sign in.
2. Upload a fabric photo or take one with your camera.
3. Choose a category, style and occasion. Add your own instructions if you have something specific in mind.
4. Generate a set of designs. Each image appears as it finishes.
5. Open designs at full size, download them or save favourites to your private wardrobe.

Outfit categories include dresses, skirt-and-blouse combinations, jumpsuits and men's sets. Shoes and bags have their own categories and hardware options.

## How we use Meta

Fashley uses **Muse Image 1.0 (`muse-image-1.0`)** through the Meta Model API. Each generation request includes the customer's fabric photo and a prompt assembled on the server from their selections and optional description.

The prompt gives concrete design instructions for the selected category and style, alongside instructions to retain the reference fabric's colours, motifs and pattern scale. Each image in a set receives a different design brief, giving the customer alternatives to compare. Requests run in parallel, and our server streams completed images to the browser.

These are generated concepts, not production patterns. Fabric details and garment construction may differ from the reference and should be checked before making a physical item.

## Built with

- React, TypeScript and TanStack Start
- Tailwind CSS and Radix UI
- Cloudflare Workers for hosting and server APIs
- Cloudflare D1 for application data
- Private Cloudflare R2 storage for saved images
- Clerk for authentication
- Meta Model API for image generation

## Development

```sh
git clone https://github.com/Kasalite-Technologies/fashley.git
cd fashley
pnpm install
pnpm dev
```

Authentication, generation and saved designs require Clerk configuration, Meta API access and Cloudflare bindings. See `cloudflare.config.ts` for deployed resources and `.env.example` for configuration notes. Server credentials belong in Cloudflare Secrets Store, never in client-side variables or committed files.

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Contact

[Kasalite Technologies](https://github.com/Kasalite-Technologies)
