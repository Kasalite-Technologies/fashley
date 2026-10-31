import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/projects/$id/history")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handlersFromEnv().projectHistory(request, params.id),
    },
  },
});
