import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/organizer/events/$eventId/withdraw")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        eventsHandlers().withdrawMyEvent(request, params.eventId),
    },
  },
});
