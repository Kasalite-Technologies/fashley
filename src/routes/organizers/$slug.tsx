import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { BackButton } from "@/components/BackButton";
import { loadOrganizer } from "@/lib/events/server-fns";
import { EventListing } from "@/routes/events/index";
import type { OrganizerProfile } from "@/lib/events/contracts";
import "@/styles/events.css";

export const Route = createFileRoute("/organizers/$slug")({
  loader: async ({ params }) => {
    const profile = await loadOrganizer({ data: { slug: params.slug } });
    if (!profile) throw notFound();
    return profile;
  },
  head: ({ loaderData }) => {
    const profile = loaderData as OrganizerProfile | undefined;
    if (!profile) return { meta: [{ title: "Organiser | Fashley" }] };
    return {
      meta: [
        { title: `${profile.name} | Fashley events` },
        {
          name: "description",
          content: profile.bio || `Fashion events by ${profile.name} on Fashley.`,
        },
        { property: "og:title", content: `${profile.name} | Fashley events` },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="events-page">
      <SiteHeader />
      <main className="ev-shell">
        <h1 className="text-4xl">This organiser is not listed</h1>
        <p className="mt-3 text-muted-foreground">
          The profile may have been suspended or removed.
        </p>
      </main>
    </div>
  ),
  component: OrganizerPage,
});

const organizerQuery = (slug: string) =>
  queryOptions({
    queryKey: ["organizer", slug],
    queryFn: () => loadOrganizer({ data: { slug } }),
  });

function OrganizerPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(organizerQuery(slug));
  if (!data) return null;
  const upcoming = data.events.filter((e) => new Date(e.endsAt).getTime() >= Date.now());
  const past = data.events.filter((e) => new Date(e.endsAt).getTime() < Date.now());

  return (
    <div className="events-page">
      <SiteHeader />
      <main className="ev-shell">
        <BackButton fallback="/events" label="All events" className="mb-6" />
        <h1>{data.name}</h1>
        {data.bio ? <p className="ev-head p mt-3 max-w-2xl">{data.bio}</p> : null}
        <p className="ev-card-meta mt-2">
          {[data.city, data.country].filter(Boolean).join(", ")}
          {data.website ? (
            <>
              {data.city || data.country ? " · " : ""}
              <a className="ev-link" href={data.website} target="_blank" rel="noopener noreferrer">
                Website
              </a>
            </>
          ) : null}
        </p>

        <section className="mt-10">
          <h2 className="text-2xl">Upcoming events</h2>
          {upcoming.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No upcoming events listed.</p>
          ) : (
            <div className="ev-grid">
              {upcoming.map((event) => (
                <EventListing key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>

        {past.length > 0 ? (
          <section className="mt-14">
            <h2 className="text-2xl">Past events</h2>
            <div className="ev-grid">
              {past.map((event) => (
                <EventListing key={event.id} event={event} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
