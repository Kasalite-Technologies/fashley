import { createFileRoute } from "@tanstack/react-router";
import { eventsHandlers } from "@/lib/events/server/http";

export const Route = createFileRoute("/api/admin/staff/$grantId")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) =>
        eventsHandlers().adminRevokeStaff(request, params.grantId),
    },
  },
});
