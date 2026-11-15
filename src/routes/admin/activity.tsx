import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminFrame } from "@/components/admin/AdminFrame";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { eventsApi } from "@/lib/events/client/api";

export const Route = createFileRoute("/admin/activity")({
  head: () => ({
    meta: [{ title: "Activity | Fashley Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminActivityPage,
});

function AdminActivityPage() {
  return (
    <AdminGuard>
      {() => (
        <AdminFrame title="Activity">
          <div className="admin-page-title">
            <h1>Activity</h1>
          </div>
          <p className="admin-page-sub">
            Staff actions recorded by the server. Summaries never include attendee answers, ticket
            codes or private links.
          </p>
          <ActivityList />
        </AdminFrame>
      )}
    </AdminGuard>
  );
}

function ActivityList() {
  const query = useQuery({
    queryKey: ["admin-activity"],
    queryFn: () => eventsApi.adminActivity(),
  });
  if (query.isPending)
    return (
      <p className="admin-empty" role="status">
        Loading activity…
      </p>
    );
  if (query.isError)
    return (
      <div className="admin-empty">
        <p>Activity could not load.</p>
        <button className="admin-button mt-3" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );
  if (query.data.items.length === 0)
    return <p className="admin-empty">No staff actions recorded yet.</p>;

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Action</th>
            <th scope="col">Resource</th>
            <th scope="col">Actor</th>
            <th scope="col">Summary</th>
          </tr>
        </thead>
        <tbody>
          {query.data.items.map((row) => (
            <tr key={row.id}>
              <td className="admin-cell-muted">
                {new Date(row.createdAt).toLocaleString("en-GB")}
              </td>
              <td>{row.action}</td>
              <td className="admin-cell-muted">
                {row.resourceType} · {row.resourceId}
              </td>
              <td className="admin-cell-muted">{row.actorEmail ?? "System"}</td>
              <td className="admin-cell-muted">
                {Object.entries(row.summary).length === 0
                  ? "No additional detail"
                  : Object.entries(row.summary)
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
