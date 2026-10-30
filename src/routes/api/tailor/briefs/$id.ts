import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/briefs/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handlersFromEnv().brief(request, params.id),
    },
  },
});
