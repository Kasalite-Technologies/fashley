import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/assets/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handlersFromEnv().assetContent(request, params.id),
    },
  },
});
