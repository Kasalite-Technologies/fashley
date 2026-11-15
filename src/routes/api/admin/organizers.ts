import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/admin/organizers")({
  server: {
    handlers: {
      GET: async ({ request }) => eventsHandlers().adminOrganizers(request),
    },
  },
});
