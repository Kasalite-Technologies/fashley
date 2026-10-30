import { bindings, defineConfig, exports } from "cf/config";

// Companion Workflow Worker: defines the TailorWorkflow export the main
// Worker binds to as TAILOR_WORKFLOW. Deploy this before the main Worker.
export default defineConfig({
  worker: {
    name: "fashley-tailor-workflow",
    compatibilityDate: "2025-09-02",
    compatibilityFlags: ["nodejs_compat"],
    observability: { enabled: true },
    entrypoint: "./index.ts",
    exports: {
      TailorWorkflow: exports.workflow({ name: "fashley-tailor-jobs" }),
    },
    env: {
      DB: bindings.d1({
        id: "70249e86-5820-4270-8fe1-27b91983185a",
        name: "fashley-tailor",
      }),
      TAILOR_MEDIA: bindings.r2({ name: "fashley-tailor-media" }),
      META_API_KEY: bindings.secretsStoreSecret({
        storeId: "f1a49cc62eaa46cfa793e4de4ed2ec87",
        secretName: "META_API_KEY",
      }),
    },
  },
});
