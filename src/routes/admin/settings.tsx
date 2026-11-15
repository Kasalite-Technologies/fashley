import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AdminFrame } from "@/components/admin/AdminFrame";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { eventsApi, EventApiError } from "@/lib/events/client/api";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [{ title: "Settings | Fashley Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  return (
    <AdminGuard>
      {(role) => (
        <AdminFrame title="Settings">
          <div className="admin-page-title">
            <h1>Settings</h1>
          </div>
          <p className="admin-page-sub">
            Staff access and notification operations. Event policy lives in the site terms.
          </p>
          <div className="grid gap-8 mt-6">
            <StaffSection canManage={role === "platform_admin"} />
            <NotificationSection />
          </div>
        </AdminFrame>
      )}
    </AdminGuard>
  );
}

function StaffSection({ canManage }: { canManage: boolean }) {
  const query = useQuery({ queryKey: ["admin-staff"], queryFn: () => eventsApi.adminStaff() });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"events_editor" | "platform_admin">("events_editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <section>
      <h2 className="text-xl">Staff access</h2>
      <p className="admin-page-sub">
        A grant is checked on every request. Revoking takes effect on the next request, not after a
        cache. The last platform admin cannot be removed.
      </p>
      {query.isPending ? (
        <p className="admin-empty" role="status">
          Loading staff…
        </p>
      ) : query.isError ? (
        <p className="admin-empty">Staff grants could not load.</p>
      ) : query.data.items.length === 0 ? (
        <p className="admin-empty">No staff grants yet.</p>
      ) : (
        <div className="admin-list mt-4">
          {query.data.items.map((grant) => (
            <div key={grant.id} className="admin-list-row">
              <div>
                <strong>{grant.email ?? grant.userId}</strong>
                <div className="admin-cell-muted">{grant.role.replace("_", " ")}</div>
              </div>
              {canManage ? (
                <button
                  className="admin-button"
                  data-variant="danger"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await eventsApi.adminRevokeStaff(grant.id);
                      toast.success("Access revoked");
                      await query.refetch();
                    } catch (e) {
                      toast.error(
                        e instanceof EventApiError ? e.failure.message : "That action failed.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Revoke
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {canManage ? (
        <form
          className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await eventsApi.adminGrantStaff(email, role);
              toast.success("Access granted");
              setEmail("");
              await query.refetch();
            } catch (err) {
              setError(
                err instanceof EventApiError
                  ? err.failure.message
                  : "That grant could not be saved.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="admin-field" style={{ marginBottom: 0 }}>
            <span>Verified account email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@example.com"
            />
          </label>
          <label className="admin-field" style={{ marginBottom: 0 }}>
            <span>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="events_editor">Events editor</option>
              <option value="platform_admin">Platform admin</option>
            </select>
          </label>
          <button className="admin-button" data-variant="primary" disabled={busy}>
            {busy ? "Saving…" : "Grant access"}
          </button>
        </form>
      ) : (
        <p className="admin-note mt-4">Only a platform admin can grant or revoke access.</p>
      )}
      {error ? <p className="admin-error">{error}</p> : null}
      <p className="admin-note mt-4">
        The account must have signed in to Fashley events at least once so its verified email is
        known. Access is never granted from an unverified email match.
      </p>
    </section>
  );
}

function NotificationSection() {
  const [busy, setBusy] = useState(false);
  return (
    <section>
      <h2 className="text-xl">Notifications</h2>
      <p className="admin-page-sub">
        Confirmation, review and cancellation messages are written to a durable outbox with the
        business change, then delivered. A provider outage never cancels a registration.
      </p>
      <div className="admin-note mt-3">
        Delivery requires a configured transactional sender. Without one, messages stay queued and
        this button reports that nothing was sent.
      </div>
      <button
        className="admin-button mt-4"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const result = await eventsApi.dispatchNotifications();
            toast.success(`Sent ${result.sent}, failed ${result.failed}`);
          } catch (e) {
            toast.error(e instanceof EventApiError ? e.failure.message : "Dispatch could not run.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Dispatching…" : "Send pending notifications"}
      </button>
    </section>
  );
}
