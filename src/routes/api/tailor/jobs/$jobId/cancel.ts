import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/jobs/$jobId/cancel")({
  server: {
    handlers: {
      POST: async ({ request, params }) => handlersFromEnv().cancelJob(request, params.jobId),
    },
  },
});
