import { bindings, defineConfig } from "cf/config";

// Publishable key is read from the deploy shell environment, never committed.
// Set VITE_CLERK_PUBLISHABLE_KEY when running `cf deploy`; when unset, the
// binding is omitted and the frontend reports sign-in as not configured.
const clerkPublishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY;

export default defineConfig({
  worker: {
    name: "kasalite-technologies-fashley",
    compatibilityDate: "2025-09-02",
    compatibilityFlags: ["nodejs_compat"],
    observability: { enabled: true },
    // src/server.ts is the SSR error wrapper around @tanstack/react-start/server-entry.
    entrypoint: "./src/server.ts",
    env: {
      DB: bindings.d1({
        id: "70249e86-5820-4270-8fe1-27b91983185a",
        name: "fashley-tailor",
      }),
      TAILOR_MEDIA: bindings.r2({ name: "fashley-tailor-media" }),
      CLERK_SECRET_KEY: bindings.secretsStoreSecret({
        storeId: "f1a49cc62eaa46cfa793e4de4ed2ec87",
        secretName: "CLERK_SECRET_KEY",
      }),
      META_API_KEY: bindings.secretsStoreSecret({
        storeId: "f1a49cc62eaa46cfa793e4de4ed2ec87",
        secretName: "META_API_KEY",
      }),
      // Companion Workflow Worker (workers/tailor-workflow) must be deployed
      // before dispatch succeeds; until then job creation fails closed.
      TAILOR_WORKFLOW: bindings.workflow({
        name: "fashley-tailor-jobs",
        worker: "fashley-tailor-workflow",
        exportName: "TailorWorkflow",
      }),
      VITE_CLERK_PUBLISHABLE_KEY: clerkPublishableKey
        ? bindings.text(clerkPublishableKey)
        : undefined,
    },
  },
});
