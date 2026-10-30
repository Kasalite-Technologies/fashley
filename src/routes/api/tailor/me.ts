import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/me")({
  server: {
    handlers: {
      GET: async ({ request }) => handlersFromEnv().me(request),
    },
  },
});
