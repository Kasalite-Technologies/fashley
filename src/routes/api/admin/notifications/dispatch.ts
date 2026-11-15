import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/admin/notifications/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => eventsHandlers().dispatchNotifications(request),
    },
  },
});
