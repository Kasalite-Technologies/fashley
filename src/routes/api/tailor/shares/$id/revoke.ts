import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/shares/$id/revoke")({
  server: {
    handlers: {
      POST: async ({ request, params }) => handlersFromEnv().revokeShare(request, params.id),
    },
  },
});
