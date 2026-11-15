import { Link, useLocation } from "@tanstack/react-router";
import { DEFAULT_ADMIN_SEARCH } from "@/lib/events/contracts";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { eventsApi } from "@/lib/events/client/api";
import "@/styles/admin.css";

const NAV = [
  { to: "/admin/events", label: "Events", exact: false },
  { to: "/admin/organizers", label: "Organisers", exact: false },
  { to: "/admin/reports", label: "Reports", exact: false },
  { to: "/admin/activity", label: "Activity", exact: false },
  { to: "/admin/settings", label: "Settings", exact: false },
] as const;

export function AdminFrame({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const pathname = useLocation({ select: (s) => s.pathname });
  const counts = useQuery({
    queryKey: ["admin-counts"],
    queryFn: () => eventsApi.adminCounts(),
    retry: false,
  });

  return (
    <div className="admin-root">
      <a className="admin-sr-only" href="#admin-main">
        Skip to content
      </a>
      <aside className="admin-sidebar" aria-label="Admin workspace">
        <Link to="/" className="admin-workspace">
          <span className="admin-workspace-mark" aria-hidden="true">
            F
          </span>
          Fashley Admin
        </Link>
        <nav className="admin-nav" aria-label="Admin sections">
          <p className="admin-nav-section">Workspace</p>
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              data-active={pathname === item.to || pathname.startsWith(`${item.to}/`)}
            >
              {item.label}
              {item.label === "Events" && (counts.data?.needsReview ?? 0) > 0 ? (
                <span className="admin-nav-count">{counts.data?.needsReview}</span>
              ) : null}
              {item.label === "Reports" && (counts.data?.openReports ?? 0) > 0 ? (
                <span className="admin-nav-count">{counts.data?.openReports}</span>
              ) : null}
            </Link>
          ))}
          <p className="admin-nav-section">Directory views</p>
          <div className="admin-nav admin-nav-nested">
            <Link
              to="/admin/events"
              search={{ ...DEFAULT_ADMIN_SEARCH, view: "needs_review" }}
              data-active={pathname === "/admin/events"}
            >
              Needs review
            </Link>
            <Link to="/admin/events" search={{ ...DEFAULT_ADMIN_SEARCH, view: "published" }}>
              Published
            </Link>
            <Link to="/admin/events" search={{ ...DEFAULT_ADMIN_SEARCH, view: "upcoming" }}>
              Upcoming
            </Link>
          </div>
        </nav>
        <div className="admin-sidebar-footer">
          <a href="/events">Back to Fashley events</a>
        </div>
      </aside>
      <div className="admin-main">
        <div className="admin-topbar">
          <span>Fashley</span>
          <span aria-hidden="true">/</span>
          <strong>{title}</strong>
          <div className="admin-topbar-actions">{actions}</div>
        </div>
        <main id="admin-main" className="admin-page">
          {children}
        </main>
      </div>
    </div>
  );
}
