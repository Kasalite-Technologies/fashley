import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/organizer/events/$eventId/attendees")({
  server: {
    handlers: {
      GET: async ({ request, params }) => eventsHandlers().myAttendees(request, params.eventId),
    },
  },
});
