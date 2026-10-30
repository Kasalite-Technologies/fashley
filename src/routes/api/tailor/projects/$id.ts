import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/projects/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handlersFromEnv().project(request, params.id),
      DELETE: async ({ request, params }) => handlersFromEnv().deleteProject(request, params.id),
    },
  },
});
