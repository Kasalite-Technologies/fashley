import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AdminFrame } from "@/components/admin/AdminFrame";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { eventsApi, EventApiError } from "@/lib/events/client/api";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/events/contracts";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [{ title: "Reports | Fashley Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminReportsPage,
});

function AdminReportsPage() {
  return (
    <AdminGuard>
      {() => (
        <AdminFrame title="Reports">
          <div className="admin-page-title">
            <h1>Reports</h1>
          </div>
          <p className="admin-page-sub">
            Reports submitted from public event pages. Resolve after checking the listing.
          </p>
          <ReportList />
        </AdminFrame>
      )}
    </AdminGuard>
  );
}

function ReportList() {
  const query = useQuery({ queryKey: ["admin-reports"], queryFn: () => eventsApi.adminReports() });
  const [busyId, setBusyId] = useState("");
  const [note, setNote] = useState("");

  if (query.isPending)
    return (
      <p className="admin-empty" role="status">
        Loading reports…
      </p>
    );
  if (query.isError)
    return (
      <div className="admin-empty">
        <p>Reports could not load.</p>
        <button className="admin-button mt-3" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );
  if (query.data.items.length === 0)
    return <p className="admin-empty">No reports have been filed.</p>;

  return (
    <div className="grid gap-4">
      <label className="admin-field">
        <span>Resolution note (applied to the report you resolve)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} />
      </label>
      {query.data.items.map((report) => (
        <div key={report.id} className="admin-note">
          <div className="flex flex-wrap items-center gap-2">
            <span className="admin-pill" data-tone={report.status === "open" ? "review" : "draft"}>
              {report.status}
            </span>
            <Link
              className="admin-cell-title"
              to="/events/$slug"
              params={{ slug: report.eventSlug }}
            >
              {report.eventTitle}
            </Link>
            <span className="admin-cell-muted">
              {REPORT_REASON_LABELS[report.reason as ReportReason] ?? report.reason} ·{" "}
              {new Date(report.createdAt).toLocaleString("en-GB")}
            </span>
          </div>
          {report.detail ? <p className="mt-2">{report.detail}</p> : null}
          {report.status === "open" ? (
            <div className="mt-3 flex gap-2">
              <button
                className="admin-button"
                disabled={busyId === report.id}
                onClick={async () => {
                  setBusyId(report.id);
                  try {
                    await eventsApi.adminResolveReport(report.id, "resolved", note);
                    toast.success("Report resolved");
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
                Resolve
              </button>
              <button
                className="admin-button"
                data-variant="quiet"
                disabled={busyId === report.id}
                onClick={async () => {
                  setBusyId(report.id);
                  try {
                    await eventsApi.adminResolveReport(report.id, "dismissed", note);
                    toast.success("Report dismissed");
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
                Dismiss
              </button>
            </div>
          ) : report.resolutionNote ? (
            <p className="admin-cell-muted mt-2">Resolution: {report.resolutionNote}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
