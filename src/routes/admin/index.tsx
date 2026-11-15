import { createFileRoute } from "@tanstack/react-router";
import { AdminFrame } from "@/components/admin/AdminFrame";
import { AdminGuard } from "@/components/admin/AdminGuard";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Fashley Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminHome,
});

function AdminHome() {
  return (
    <AdminGuard>
      {(role) => (
        <AdminFrame title="Overview">
          <div className="admin-page-title">
            <h1>Fashley Admin</h1>
          </div>
          <p className="admin-page-sub">
            Events is the first managed area. Open it to review submissions and run the directory.
          </p>
          <div className="mt-6">
            <a className="admin-button" data-variant="primary" href="/admin/events">
              Open events
            </a>
          </div>
          <dl className="admin-props mt-8" style={{ maxWidth: 420 }}>
            <div className="admin-prop">
              <dt>Your role</dt>
              <dd>{role === "platform_admin" ? "Platform admin" : "Events editor"}</dd>
            </div>
          </dl>
        </AdminFrame>
      )}
    </AdminGuard>
  );
}
