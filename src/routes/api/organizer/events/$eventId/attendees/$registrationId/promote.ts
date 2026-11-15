import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute(
  "/api/organizer/events/$eventId/attendees/$registrationId/promote",
)({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        eventsHandlers().promote(request, params.eventId, params.registrationId),
    },
  },
});
