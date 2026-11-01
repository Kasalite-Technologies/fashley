import { createFileRoute } from "@tanstack/react-router";
import { studioHandlers } from "@/lib/tailor/server/studio";
export const Route = createFileRoute("/api/studio/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => studioHandlers().generate(request),
    },
  },
});
