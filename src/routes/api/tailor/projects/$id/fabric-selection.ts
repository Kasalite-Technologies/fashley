import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/projects/$id/fabric-selection")({
  server: {
    handlers: {
      POST: async ({ request, params }) => handlersFromEnv().fabricSelection(request, params.id),
    },
  },
});
