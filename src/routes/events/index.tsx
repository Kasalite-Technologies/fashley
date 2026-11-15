import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { loadDirectory } from "@/lib/events/server-fns";
import {
  CATEGORY_LABELS,
  DEFAULT_DIRECTORY_SEARCH,
  EVENT_CATEGORIES,
  EVENT_FORMATS,
  FORMAT_LABELS,
  formatEventDate,
  type EventCard,
} from "@/lib/events/contracts";
import { AvailabilityTag } from "@/components/events/AvailabilityTag";
import "@/styles/events.css";

export type DirectorySearch = {
  q: string;
  city: string;
  category: string;
  format: string;
  when: "upcoming" | "past";
  page: number;
};

export const Route = createFileRoute("/events/")({
  validateSearch: (search: Record<string, unknown>): DirectorySearch => ({
    q: typeof search["q"] === "string" ? search["q"].slice(0, 120) : "",
    city: typeof search["city"] === "string" ? search["city"].slice(0, 80) : "",
    category: (EVENT_CATEGORIES as readonly string[]).includes(String(search["category"]))
      ? String(search["category"])
      : "",
    format: (EVENT_FORMATS as readonly string[]).includes(String(search["format"]))
      ? String(search["format"])
      : "",
    when: search["when"] === "past" ? "past" : "upcoming",
    page: Math.max(1, Math.min(200, Number(search["page"]) || 1)),
  }),
  head: () => ({
    meta: [
      { title: "Fashion events | Fashley" },
      {
        name: "description",
        content:
          "Fashion shows, markets, workshops and talks across Africa. Register on Fashley or submit an event for the directory.",
      },
      { property: "og:title", content: "Fashion events | Fashley" },
      {
        property: "og:description",
        content:
          "Fashion shows, markets, workshops and talks across Africa. Register on Fashley or submit an event for the directory.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(directoryQuery(deps)),
  component: EventsDirectory,
});

const directoryQuery = (search: DirectorySearch) =>
  queryOptions({
    queryKey: ["events-directory", search],
    queryFn: () =>
      loadDirectory({
        data: {
          q: search.q,
          city: search.city,
          category: search.category,
          format: search.format,
          when: search.when,
          page: search.page,
        },
      }),
  });

export function EventListing({ event }: { event: EventCard }) {
  return (
    <Link
      to="/events/$slug"
      params={{ slug: event.slug }}
      className="ev-card"
      aria-labelledby={`event-${event.id}-title`}
    >
      <div className="ev-card-media" data-empty={!event.coverUrl}>
        {event.coverUrl ? (
          <img src={event.coverUrl} alt="" loading="lazy" width={640} height={480} />
        ) : (
          <span>{CATEGORY_LABELS[event.category]}</span>
        )}
      </div>
      <div className="ev-card-body">
        <span className="ev-card-date">
          {formatEventDate(event.startsAt, event.endsAt, event.timezone)}
        </span>
        <h3 className="ev-card-title" id={`event-${event.id}-title`}>
          {event.title}
        </h3>
        <span className="ev-card-meta">
          {event.format === "online" ? "Online" : (event.city ?? "Location to be confirmed")}
          {event.format === "hybrid" ? " and online" : ""} · {event.organizerName}
        </span>
        <div className="ev-tags">
          <span className="ev-tag">{CATEGORY_LABELS[event.category]}</span>
          <AvailabilityTag availability={event.availability} />
        </div>
      </div>
    </Link>
  );
}

function EventsDirectory() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(directoryQuery(search));
  const total = data.events.total;
  const pageCount = Math.max(1, Math.ceil(total / data.events.pageSize));

  function update(patch: Partial<DirectorySearch>) {
    void navigate({
      to: "/events",
      search: (prev) => ({
        ...DEFAULT_DIRECTORY_SEARCH,
        ...prev,
        ...patch,
        page: patch.page ?? 1,
      }),
    });
  }

  return (
    <div className="events-page">
      <SiteHeader />
      <main className="ev-shell">
        <div className="ev-head">
          <div>
            <h1>Fashion events</h1>
            <p>
              Runway shows, fabric markets, workshops and industry talks. Register here and keep the
              ticket in your Fashley account.
            </p>
          </div>
          <div className="ev-head-actions">
            <Link to="/events/mine" className="ev-button" data-variant="quiet">
              My events
            </Link>
            <Link to="/events/submit" className="ev-button" data-variant="accent">
              Submit an event
            </Link>
          </div>
        </div>

        <form
          className="ev-filters"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            update({
              q: String(form.get("q") ?? ""),
              city: String(form.get("city") ?? ""),
            });
          }}
        >
          <label className="ev-field" data-grow="true">
            <span>Search</span>
            <input name="q" defaultValue={search.q} placeholder="Event or organiser" />
          </label>
          <label className="ev-field">
            <span>City</span>
            <input name="city" defaultValue={search.city} placeholder="Accra" list="event-cities" />
            <datalist id="event-cities">
              {data.cities.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </label>
          <label className="ev-field">
            <span>Category</span>
            <select value={search.category} onChange={(e) => update({ category: e.target.value })}>
              <option value="">Any category</option>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="ev-field">
            <span>Attendance</span>
            <select value={search.format} onChange={(e) => update({ format: e.target.value })}>
              <option value="">Any format</option>
              {EVENT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABELS[f]}
                </option>
              ))}
            </select>
          </label>
          <div className="ev-field">
            <span>When</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                className="ev-button"
                data-variant={search.when === "upcoming" ? "accent" : "quiet"}
                onClick={() => update({ when: "upcoming" })}
              >
                Upcoming
              </button>
              <button
                type="button"
                className="ev-button"
                data-variant={search.when === "past" ? "accent" : "quiet"}
                onClick={() => update({ when: "past" })}
              >
                Past
              </button>
            </div>
          </div>
          <Button type="submit" className="ev-button" data-variant="quiet">
            Apply
          </Button>
        </form>

        {data.featured.length > 0 ? (
          <section className="mt-12" aria-labelledby="featured-heading">
            <h2 id="featured-heading" className="text-2xl">
              Featured
            </h2>
            <div className="ev-grid">
              {data.featured.map((event) => (
                <EventListing key={event.id} event={event} />
              ))}
            </div>
          </section>
        ) : null}

        <p className="ev-count">
          {total === 0
            ? "No events match these filters"
            : `${total} event${total === 1 ? "" : "s"}`}
          {search.q ? ` matching “${search.q}”` : ""}
        </p>

        {total === 0 ? (
          <div className="ev-empty">
            <h2>Nothing here yet</h2>
            <p>
              Adjust the filters, or submit an event if you are organising one. Listings appear
              after review.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                className="ev-button"
                data-variant="quiet"
                to="/events"
                search={DEFAULT_DIRECTORY_SEARCH}
              >
                Clear filters
              </Link>
              <Link className="ev-button" data-variant="accent" to="/events/submit">
                Submit an event
              </Link>
            </div>
          </div>
        ) : (
          <div className="ev-grid">
            {data.events.items.map((event) => (
              <EventListing key={event.id} event={event} />
            ))}
          </div>
        )}

        {pageCount > 1 ? (
          <nav className="ev-pagination" aria-label="Event pages">
            {search.page > 1 ? (
              <Link to="/events" search={{ ...search, page: search.page - 1 }}>
                Previous
              </Link>
            ) : null}
            <span>
              Page {search.page} of {pageCount}
            </span>
            {search.page < pageCount ? (
              <Link to="/events" search={{ ...search, page: search.page + 1 }}>
                Next
              </Link>
            ) : null}
          </nav>
        ) : null}
      </main>
    </div>
  );
}
