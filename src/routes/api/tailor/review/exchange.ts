import { createFileRoute } from "@tanstack/react-router";
import { handlersFromEnv } from "@/lib/tailor/server/http";
export const Route = createFileRoute("/api/tailor/review/exchange")({
  server: {
    handlers: {
      POST: async ({ request }) => handlersFromEnv().reviewExchange(request),
    },
  },
});
