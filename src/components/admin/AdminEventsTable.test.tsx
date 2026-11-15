import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AdminEventRow, Paginated } from "@/lib/events/contracts";

/**
 * The admin table is rendered with a stubbed API so the layout, view tabs and
 * side-peek wiring are exercised without a live Clerk session. The server's
 * authorization is covered separately by the SQLite tests.
 */

const navigate = vi.fn();
// A lightweight Link keeps this a component test: no router instance is
// mounted, and URL state is asserted through the navigate spy instead.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

const rows: AdminEventRow[] = [
  {
    id: "evt_pending",
    slug: "kumasi-runway-night",
    title: "Kumasi Runway Night",
    reviewState: "submitted",
    publication: "unpublished",
    lifecycle: "scheduled",
    startsAt: "2027-04-18T18:30:00.000Z",
    endsAt: "2027-04-18T21:00:00.000Z",
    timezone: "Africa/Accra",
    city: "Kumasi",
    format: "in_person",
    category: "fashion-show",
    organizerId: "org_demo",
    organizerName: "Accra Textile Studio",
    confirmedCount: 0,
    capacity: 200,
    waitlistCount: 0,
    submittedAt: "2026-11-15T08:00:00.000Z",
    updatedAt: "2026-11-15T08:00:00.000Z",
  },
  {
    id: "evt_demo",
    slug: "accra-textile-market",
    title: "Accra Textile Market",
    reviewState: "approved",
    publication: "published",
    lifecycle: "scheduled",
    startsAt: "2027-03-05T09:00:00.000Z",
    endsAt: "2027-03-06T17:00:00.000Z",
    timezone: "Africa/Accra",
    city: "Accra",
    format: "in_person",
    category: "fabric-market",
    organizerId: "org_demo",
    organizerName: "Accra Textile Studio",
    confirmedCount: 12,
    capacity: 80,
    waitlistCount: 3,
    submittedAt: null,
    updatedAt: "2026-11-14T09:00:00.000Z",
  },
];

const page: Paginated<AdminEventRow> = { items: rows, total: 2, page: 1, pageSize: 25 };

const adminEvents = vi.fn(async () => page);
const adminEvent = vi.fn();
const adminCounts = vi.fn(async () => ({
  needsReview: 1,
  changesRequested: 0,
  published: 1,
  suspended: 0,
  openReports: 0,
}));

vi.mock("@/lib/events/client/api", () => {
  class EventApiError extends Error {}
  return {
    EventApiError,
    eventsApi: {
      adminEvents: (...args: unknown[]) => adminEvents(...(args as [])),
      adminEvent: (...args: unknown[]) => adminEvent(...(args as [])),
      adminCounts: () => adminCounts(),
    },
  };
});

import { AdminEventsTable } from "./AdminEventsTable";
import type { AdminEventSearch } from "./AdminEventsTable";
import { DEFAULT_ADMIN_SEARCH } from "@/lib/events/contracts";

const search: AdminEventSearch = { ...DEFAULT_ADMIN_SEARCH };

function renderTable(overrides: Partial<AdminEventSearch> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminEventsTable search={{ ...search, ...overrides }} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  navigate.mockReset();
  adminEvents.mockClear();
});
afterEach(() => cleanup());

describe("admin events table", () => {
  it("lists every event with review and publication state", async () => {
    renderTable();
    expect(await screen.findByText("Kumasi Runway Night")).toBeInTheDocument();
    expect(screen.getByText("Accra Textile Market")).toBeInTheDocument();
    expect(screen.getByText("In review")).toBeInTheDocument();
    // "Published" is both a saved view tab and a row pill; assert the pill.
    expect(screen.getAllByText("Published").some((el) => el.classList.contains("admin-pill"))).toBe(
      true,
    );
    expect(screen.getByText("12 / 80 (+3 waiting)")).toBeInTheDocument();
    expect(screen.getByText("2 events · page 1 of 1")).toBeInTheDocument();
  });

  it("renders one tab per saved view and marks the active one", async () => {
    renderTable({ view: "needs_review" });
    await screen.findByText("Kumasi Runway Night");
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "All events",
      "Needs review",
      "Changes requested",
      "Published",
      "Upcoming",
      "Past and cancelled",
    ]);
    expect(screen.getByRole("tab", { name: "Needs review" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("switches view through the URL, not local-only state", async () => {
    renderTable();
    await screen.findByText("Kumasi Runway Night");
    fireEvent.click(screen.getByRole("tab", { name: "Published" }));
    expect(navigate).toHaveBeenCalledTimes(1);
    const call = navigate.mock.calls[0]?.[0] as {
      search: (p: AdminEventSearch) => AdminEventSearch;
    };
    expect(call.search({ ...search })).toMatchObject({ view: "published", page: 1 });
  });

  it("opens the side peek for the selected record", async () => {
    adminEvent.mockResolvedValue({
      ...rows[0],
      summary: "Graduate collections.",
      description: "A single-night show.",
      venue: "Cultural Centre",
      country: "Ghana",
      onlineUrlPrivate: "https://meet.example.com/private-room",
      accessibility: "",
      ageLimit: null,
      registrationOpensAt: null,
      registrationClosesAt: null,
      registrationClosed: false,
      waitlistEnabled: false,
      coverUrl: null,
      revisionId: "rev_pending",
      revisionNo: 1,
      approvedRevisionNo: 0,
      organizers: [
        {
          id: "org_demo",
          name: "Accra Textile Studio",
          slug: "accra-textile-studio",
          contactEmail: "studio@example.com",
          status: "active",
        },
      ],
      reviews: [],
    });
    renderTable({ peek: "evt_pending" });
    await screen.findByText("Kumasi Runway Night");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    // The peek opens on Details; private access notes live behind the
    // organiser-facing fields this screen deliberately does not expose.
    expect(screen.getByText("Cultural Centre, Kumasi, Ghana")).toBeInTheDocument();
    // Approving publishes; the message is optional for approval.
    expect(screen.getByRole("button", { name: "Approve and publish" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Request changes" })).toBeDisabled();
  });

  it("shows an empty state instead of a blank table", async () => {
    adminEvents.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 25 });
    renderTable({ view: "needs_review" });
    await waitFor(() =>
      expect(screen.getByText("Nothing is waiting for review.")).toBeInTheDocument(),
    );
  });
});
