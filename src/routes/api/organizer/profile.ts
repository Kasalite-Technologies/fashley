import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/organizer/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => eventsHandlers().myOrganizer(request),
      PUT: async ({ request }) => eventsHandlers().saveOrganizer(request),
    },
  },
});
