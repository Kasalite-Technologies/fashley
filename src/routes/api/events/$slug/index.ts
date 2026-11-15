import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/events/$slug/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => eventsHandlers().event(request, params.slug),
    },
  },
});
