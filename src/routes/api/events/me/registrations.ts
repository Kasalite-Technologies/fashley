import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/events/me/registrations")({
  server: {
    handlers: {
      GET: async ({ request }) => eventsHandlers().myRegistrations(request),
    },
  },
});
