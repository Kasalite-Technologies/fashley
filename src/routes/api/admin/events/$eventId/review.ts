import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/admin/events/$eventId/review")({
  server: {
    handlers: {
      POST: async ({ request, params }) => eventsHandlers().adminReview(request, params.eventId),
    },
  },
});
