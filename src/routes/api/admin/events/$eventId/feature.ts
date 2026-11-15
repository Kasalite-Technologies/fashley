import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/admin/events/$eventId/feature")({
  server: {
    handlers: {
      POST: async ({ request, params }) => eventsHandlers().adminFeature(request, params.eventId),
    },
  },
});
