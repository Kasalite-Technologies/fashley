import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/admin/reports/$reportId/resolve")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        eventsHandlers().adminResolveReport(request, params.reportId),
    },
  },
});
