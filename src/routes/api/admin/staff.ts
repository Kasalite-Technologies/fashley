import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/admin/staff")({
  server: {
    handlers: {
      GET: async ({ request }) => eventsHandlers().adminStaff(request),
      POST: async ({ request }) => eventsHandlers().adminGrantStaff(request),
    },
  },
});
