import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/events/cities")({
  server: {
    handlers: {
      GET: async () => eventsHandlers().cities(),
    },
  },
});
