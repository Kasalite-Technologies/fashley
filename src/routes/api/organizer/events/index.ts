import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/organizer/events/")({
  server: {
    handlers: {
      GET: async ({ request }) => eventsHandlers().myEvents(request),
      POST: async ({ request }) => eventsHandlers().createEvent(request),
    },
  },
});
