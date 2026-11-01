import { createFileRoute } from "@tanstack/react-router";
import { studioHandlers } from "@/lib/tailor/server/studio";
export const Route = createFileRoute("/api/studio/designs")({
  server: {
    handlers: {
      GET: async ({ request }) => studioHandlers().designs(request),
      POST: async ({ request }) => studioHandlers().saveDesign(request),
    },
  },
});
