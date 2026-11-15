import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/admin/counts")({
  server: {
    handlers: {
      GET: async ({ request }) => eventsHandlers().adminCounts(request),
    },
  },
});
