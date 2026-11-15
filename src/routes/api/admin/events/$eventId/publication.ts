import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/admin/events/$eventId/publication")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        eventsHandlers().adminPublication(request, params.eventId),
    },
  },
});
