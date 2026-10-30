import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/projects/$id/draft")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => handlersFromEnv().saveDraft(request, params.id),
    },
  },
});
