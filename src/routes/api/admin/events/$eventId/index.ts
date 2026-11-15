import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/admin/events/$eventId/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => eventsHandlers().adminEvent(request, params.eventId),
    },
  },
});
