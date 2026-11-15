import { createFileRoute } from "@tanstack/react-router";
import { AdminFrame } from "@/components/admin/AdminFrame";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminEventsTable, type AdminEventSearch } from "@/components/admin/AdminEventsTable";
import {
  ADMIN_SORT_FIELDS,
  ADMIN_VIEWS,
  type AdminSortField,
  type AdminView,
} from "@/lib/events/contracts";

export const Route = createFileRoute("/admin/events/$eventId")({
  validateSearch: (search: Record<string, unknown>): AdminEventSearch => ({
    view: (ADMIN_VIEWS as readonly string[]).includes(String(search["view"]))
      ? (search["view"] as AdminView)
      : "all",
    q: typeof search["q"] === "string" ? search["q"].slice(0, 120) : "",
    category: typeof search["category"] === "string" ? search["category"].slice(0, 60) : "",
    city: typeof search["city"] === "string" ? search["city"].slice(0, 80) : "",
    sort: (ADMIN_SORT_FIELDS as readonly string[]).includes(String(search["sort"]))
      ? (search["sort"] as AdminSortField)
      : "updated_at",
    dir: search["dir"] === "asc" ? "asc" : "desc",
    page: Math.max(1, Math.min(200, Number(search["page"]) || 1)),
    peek: String(search["peek"] ?? ""),
  }),
  head: () => ({
    meta: [{ title: "Event | Fashley Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminEventPage,
});

function AdminEventPage() {
  const { eventId } = Route.useParams();
  const search = Route.useSearch();
  return (
    <AdminGuard>
      {() => (
        <AdminFrame title="Event">
          <div className="admin-page-title">
            <h1>Event</h1>
          </div>
          <p className="admin-page-sub">
            Deep-linked record. Closing the panel returns to the table with the same filters.
          </p>
          <AdminEventsTable search={{ ...search, peek: eventId }} />
        </AdminFrame>
      )}
    </AdminGuard>
  );
}
