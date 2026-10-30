import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/projects/$id/uploads/$uploadId")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        handlersFromEnv().getUpload(request, params.id, params.uploadId),
    },
  },
});
