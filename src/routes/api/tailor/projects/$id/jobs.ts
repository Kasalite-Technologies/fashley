import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/projects/$id/jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => handlersFromEnv().startJob(request),
    },
  },
});
