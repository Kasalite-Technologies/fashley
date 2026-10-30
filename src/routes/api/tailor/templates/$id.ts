import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/templates/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handlersFromEnv().template(request, params.id),
    },
  },
});
