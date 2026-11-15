import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/organizers/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => eventsHandlers().organizer(request, params.slug),
    },
  },
});
