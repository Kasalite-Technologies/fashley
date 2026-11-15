import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/events/$slug/reports")({
  server: {
    handlers: {
      POST: async ({ request, params }) => eventsHandlers().report(request, params.slug),
    },
  },
});
