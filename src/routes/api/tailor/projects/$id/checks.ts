import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/projects/$id/checks")({
  server: {
    handlers: {
      POST: async ({ request, params }) => handlersFromEnv().checks(request, params.id),
    },
  },
});
