import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/projects")({
  server: {
    handlers: {
      GET: async ({ request }) => handlersFromEnv().projects(request),
      POST: async ({ request }) => handlersFromEnv().createProject(request),
    },
  },
});
