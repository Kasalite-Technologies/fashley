import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/organizer/events/$eventId/cover")({
  server: {
    handlers: {
      POST: async ({ request, params }) => eventsHandlers().uploadCover(request, params.eventId),
    },
  },
});
