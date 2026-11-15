import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import "@/styles/events.css";

const TABS = [
  { to: "/organizer/events", label: "My events" },
  { to: "/events/mine", label: "My registrations" },
  { to: "/events", label: "All events" },
] as const;

export function OrganizerShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useLocation({ select: (s) => s.pathname });
  return (
    <div className="events-page">
      <SiteHeader />
      <main className="ev-shell">
        <nav className="ev-subnav" aria-label="Event workspace">
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              data-active={pathname === tab.to || pathname.startsWith(`${tab.to}/`)}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="ev-head">
          <div>
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="ev-head-actions">{actions}</div> : null}
        </div>
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
