import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/jobs/$jobId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handlersFromEnv().getJob(request, params.jobId),
    },
  },
});
