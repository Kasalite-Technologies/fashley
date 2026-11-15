import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/organizer/events/$eventId/submit")({
  server: {
    handlers: {
      POST: async ({ request, params }) => eventsHandlers().submitMyEvent(request, params.eventId),
    },
  },
});
