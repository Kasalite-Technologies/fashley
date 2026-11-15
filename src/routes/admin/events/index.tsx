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

export const Route = createFileRoute("/admin/events/")({
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
    peek: typeof search["peek"] === "string" ? search["peek"].slice(0, 120) : "",
  }),
  head: () => ({
    meta: [{ title: "Events | Fashley Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminEventsPage,
});

function AdminEventsPage() {
  const search = Route.useSearch();
  return (
    <AdminGuard>
      {(role) => (
        <AdminFrame
          title="Events"
          actions={
            <>
              <span className="admin-page-sub" style={{ marginTop: 0 }}>
                {role === "platform_admin" ? "Platform admin" : "Events editor"}
              </span>
              <a className="admin-button" href="/events">
                Public directory
              </a>
            </>
          }
        >
          <div className="admin-page-title">
            <h1>Events</h1>
          </div>
          <p className="admin-page-sub">
            Every submission, revision and listing in one database. Open a record to review it.
          </p>
          <AdminEventsTable search={search} />
        </AdminFrame>
      )}
    </AdminGuard>
  );
}
