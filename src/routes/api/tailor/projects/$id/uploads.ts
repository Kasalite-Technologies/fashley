import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/projects/$id/uploads")({
  server: {
    handlers: {
      POST: async ({ request, params }) => handlersFromEnv().createUploadIntent(request, params.id),
    },
  },
});
