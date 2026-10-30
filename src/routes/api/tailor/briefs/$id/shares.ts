import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/briefs/$id/shares")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handlersFromEnv().shares(request, params.id),
      POST: async ({ request, params }) => handlersFromEnv().createShare(request, params.id),
    },
  },
});
