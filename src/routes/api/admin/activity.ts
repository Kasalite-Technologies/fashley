import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/admin/activity")({
  server: {
    handlers: {
      GET: async ({ request }) => eventsHandlers().adminActivity(request),
    },
  },
});
