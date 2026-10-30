import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/consents/$id/withdraw")({
  server: {
    handlers: {
      POST: async ({ request, params }) => handlersFromEnv().withdrawConsent(request, params.id),
    },
  },
});
