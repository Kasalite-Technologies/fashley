import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/events/")({
  server: {
    handlers: {
      GET: async ({ request }) => eventsHandlers().directory(request),
    },
  },
});
