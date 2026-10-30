import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/briefs/$id/finalize")({
  server: {
    handlers: {
      POST: async ({ request, params }) => handlersFromEnv().finalizeBrief(request, params.id),
    },
  },
});
