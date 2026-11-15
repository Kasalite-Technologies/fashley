import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/events/me/registrations/$registrationId/ticket")({
  server: {
    handlers: {
      GET: async ({ request, params }) => eventsHandlers().ticket(request, params.registrationId),
    },
  },
});
