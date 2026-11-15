import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/admin/reports")({
  server: {
    handlers: {
      GET: async ({ request }) => eventsHandlers().adminReports(request),
    },
  },
});
