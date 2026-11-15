import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/organizer/events/$eventId/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => eventsHandlers().myEvent(request, params.eventId),
      PUT: async ({ request, params }) => eventsHandlers().saveEvent(request, params.eventId),
    },
  },
});
