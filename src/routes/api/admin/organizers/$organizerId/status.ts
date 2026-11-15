import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/admin/organizers/$organizerId/status")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        eventsHandlers().adminOrganizerStatus(request, params.organizerId),
    },
  },
});
