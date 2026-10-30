import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/me/preferences")({
  server: {
    handlers: {
      PATCH: async ({ request }) => handlersFromEnv().updatePreferences(request),
    },
  },
});
