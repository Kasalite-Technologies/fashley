import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/events/me/registrations/$registrationId")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        eventsHandlers().myRegistration(request, params.registrationId),
      DELETE: async ({ request, params }) =>
        eventsHandlers().cancelMyRegistration(request, params.registrationId),
    },
  },
});
