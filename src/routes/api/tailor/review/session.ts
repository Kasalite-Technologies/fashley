import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/review/session")({
  server: {
    handlers: {
      GET: async ({ request }) => handlersFromEnv().reviewSession(request),
    },
  },
});
