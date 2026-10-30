import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// Minimal build for the companion Workflow Worker. Bindings, exports, and
// entrypoint are declared in cloudflare.config.ts in this directory.
export default defineConfig({
  plugins: [cloudflare()],
});
