import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AdminFrame } from "@/components/admin/AdminFrame";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { eventsApi, EventApiError } from "@/lib/events/client/api";

export const Route = createFileRoute("/admin/organizers")({
  head: () => ({
    meta: [{ title: "Organisers | Fashley Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminOrganizersPage,
});

function AdminOrganizersPage() {
  return (
    <AdminGuard>
      {() => (
        <AdminFrame title="Organisers">
          <div className="admin-page-title">
            <h1>Organisers</h1>
          </div>
          <p className="admin-page-sub">
            Public organiser identities and their contact addresses. Suspending an organiser also
            unpublishes their listings.
          </p>
          <OrganizerTable />
        </AdminFrame>
      )}
    </AdminGuard>
  );
}

function OrganizerTable() {
  const query = useQuery({
    queryKey: ["admin-organizers"],
    queryFn: () => eventsApi.adminOrganizers(),
  });
  const [busyId, setBusyId] = useState("");

  if (query.isPending)
    return (
      <p className="admin-empty" role="status">
        Loading organisers…
      </p>
    );
  if (query.isError)
    return (
      <div className="admin-empty">
        <p>Organisers could not load.</p>
        <button className="admin-button mt-3" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );
  if (query.data.items.length === 0)
    return <p className="admin-empty">No organiser profiles yet.</p>;

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">Organiser</th>
            <th scope="col">Contact</th>
            <th scope="col">Location</th>
            <th scope="col">Events</th>
            <th scope="col">Status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {query.data.items.map((org) => (
            <tr key={org.id}>
              <td>
                <Link
                  className="admin-cell-title"
                  to="/organizers/$slug"
                  params={{ slug: org.slug }}
                >
                  <span className="admin-cell-title-mark" aria-hidden="true">
                    O
                  </span>
                  {org.name}
                </Link>
              </td>
              <td className="admin-cell-muted">{org.contactEmail}</td>
              <td className="admin-cell-muted">
                {[org.city, org.country].filter(Boolean).join(", ") || "Not given"}
              </td>
              <td className="admin-cell-muted">
                {org.publishedCount} published of {org.eventCount}
              </td>
              <td>
                <span className="admin-pill" data-tone={org.status === "active" ? "live" : "stop"}>
                  {org.status === "active" ? "Active" : "Suspended"}
                </span>
              </td>
              <td>
                <button
                  className="admin-button"
                  disabled={busyId === org.id}
                  onClick={async () => {
                    setBusyId(org.id);
                    try {
                      await eventsApi.adminOrganizerStatus(
                        org.id,
                        org.status === "active" ? "suspended" : "active",
                      );
                      toast.success(
                        org.status === "active" ? "Organiser suspended" : "Organiser restored",
                      );
                      await query.refetch();
                    } catch (e) {
                      toast.error(
                        e instanceof EventApiError ? e.failure.message : "That action failed.",
                      );
                    } finally {
                      setBusyId("");
                    }
                  }}
                >
                  {org.status === "active" ? "Suspend" : "Restore"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
