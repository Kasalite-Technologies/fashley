import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/events/id/$eventId/cover")({
  server: {
    handlers: {
      GET: async ({ request, params }) => eventsHandlers().cover(request, params.eventId),
    },
  },
});
