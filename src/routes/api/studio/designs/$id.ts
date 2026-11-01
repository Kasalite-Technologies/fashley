import { createFileRoute } from "@tanstack/react-router";
import { studioHandlers } from "@/lib/tailor/server/studio";
export const Route = createFileRoute("/api/studio/designs/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => studioHandlers().designImage(request, params.id),
      DELETE: async ({ request, params }) => studioHandlers().deleteDesign(request, params.id),
    },
  },
});
