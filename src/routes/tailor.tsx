import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TailorAppShell } from "@/components/tailor/TailorAppShell";
import { ProjectCard } from "@/components/tailor/ProjectCard";
import { EmptyState, PageError } from "@/components/tailor/status";
import { isFixtureMode, tailorApi, tailorKeys } from "@/lib/tailor/client";

type Search = { q?: string; status?: string; reviewStatus?: string; cursor?: string };

export const Route = createFileRoute("/tailor")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const q = typeof search["q"] === "string" ? search["q"].slice(0, 100) : undefined;
    const cursor = typeof search["cursor"] === "string" ? search["cursor"] : undefined;
    return {
      ...(q ? { q } : {}),
      status: ["all", "active", "archived"].includes(String(search["status"]))
        ? String(search["status"])
        : "all",
      reviewStatus: [
        "all",
        "awaiting_review",
        "changes_requested",
        "design_approved",
        "accepted",
      ].includes(String(search["reviewStatus"]))
        ? String(search["reviewStatus"])
        : "all",
      ...(cursor ? { cursor } : {}),
    };
  },
  head: () => ({
    meta: [{ title: "My outfit projects | Fashley" }, { name: "robots", content: "noindex" }],
  }),
  component: TailorRoute,
});

function TailorRoute() {
  const pathname = useLocation({ select: (l) => l.pathname });
  if (pathname !== "/tailor") return <Outlet />;
  return <DashboardPage />;
}

export function DashboardPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [queryText, setQueryText] = useState(search.q ?? "");

  const me = useQuery({ queryKey: tailorKeys.me(), queryFn: () => tailorApi.me(), retry: false });
  const userId = me.data?.user.id ?? "current";
  const projects = useQuery({
    queryKey: tailorKeys.projects(userId, {
      ...(search.q ? { query: search.q } : {}),
      ...(search.status ? { status: search.status } : {}),
      ...(search.reviewStatus ? { reviewStatus: search.reviewStatus } : {}),
      ...(search.cursor ? { cursor: search.cursor } : {}),
    }),
    queryFn: () =>
      tailorApi.listProjects({
        ...(search.q ? { query: search.q } : {}),
        ...(search.status ? { status: search.status } : {}),
        ...(search.reviewStatus ? { reviewStatus: search.reviewStatus } : {}),
        ...(search.cursor ? { cursor: search.cursor } : {}),
        limit: 20,
      }),
    retry: false,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      if ((search.q ?? "") !== queryText) {
        void navigate({
          to: "/tailor",
          search: (prev) => {
            const { cursor: _cursor, q: _q, ...rest } = prev;
            return { ...rest, ...(queryText ? { q: queryText } : {}) };
          },
        });
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryText]);

  return (
    <TailorAppShell title="My outfit projects">
      <div className="project-dashboard space-y-6">
        <div className="dashboard-intro flex flex-wrap items-center gap-3">
          <p>
            Fabric, measurements, and the conversation with your tailor. Keep each outfit together.
          </p>
          <Button asChild className="min-h-11">
            <Link to="/tailor/new">Start a new outfit</Link>
          </Button>
          {isFixtureMode ? (
            <p className="text-xs text-muted-foreground">Fixture mode: synthetic test data only.</p>
          ) : null}
        </div>

        <form
          className="project-filters"
          onSubmit={(e) => e.preventDefault()}
          aria-label="Filter my outfit projects"
        >
          <div className="space-y-1.5">
            <Label htmlFor="project-search">Search my outfit projects</Label>
            <Input
              id="project-search"
              value={queryText}
              maxLength={100}
              placeholder="Search by outfit name"
              onChange={(e) => setQueryText(e.target.value)}
              className="min-h-11 rounded-full px-4"
            />
          </div>
          {/* Same chip pattern as the studio: few options, so show them
              instead of hiding them in dropdowns. */}
          <div className="filter-row">
            <p id="project-status-label">Outfit status</p>
            <div className="chip-group" role="group" aria-labelledby="project-status-label">
              {(
                [
                  ["all", "All"],
                  ["active", "Active"],
                  ["archived", "Archived"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className="chip"
                  aria-pressed={search.status === value}
                  onClick={() =>
                    void navigate({
                      to: "/tailor",
                      search: (prev) => {
                        const { cursor: _cursor, ...rest } = prev;
                        return { ...rest, status: value };
                      },
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-row">
            <p id="project-review-label">Tailor review</p>
            <div className="chip-group" role="group" aria-labelledby="project-review-label">
              {(
                [
                  ["all", "All"],
                  ["awaiting_review", "Sent to tailor, waiting"],
                  ["changes_requested", "Tailor asked for changes"],
                  ["design_approved", "Tailor approved the design"],
                  ["accepted", "Tailor approved the brief"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className="chip"
                  aria-pressed={search.reviewStatus === value}
                  onClick={() =>
                    void navigate({
                      to: "/tailor",
                      search: (prev) => {
                        const { cursor: _cursor, ...rest } = prev;
                        return { ...rest, reviewStatus: value };
                      },
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </form>

        {me.data ? (
          <div className="credits-stats" aria-label="Pilot credits">
            <div className="credit-stat">
              <strong>{me.data.credits.available}</strong>
              <span>credits available</span>
            </div>
            <div className="credit-stat">
              <strong>{me.data.credits.reserved}</strong>
              <span>reserved</span>
            </div>
            <p>Credits are part of this pilot. There is no top-up in this version.</p>
          </div>
        ) : null}

        {projects.isPending ? (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Loading outfit projects"
          >
            <Skeleton className="h-44 rounded-3xl" />
            <Skeleton className="h-44 rounded-3xl" />
            <Skeleton className="h-44 rounded-3xl" />
          </div>
        ) : projects.isError ? (
          <PageError error={projects.error} onRetry={() => void projects.refetch()} />
        ) : projects.data.items.length === 0 ? (
          search.q || search.status !== "all" || search.reviewStatus !== "all" ? (
            <EmptyState
              title="No outfit projects match these filters"
              description="Try a different search, or reset the filters to see all of your outfit projects."
              action={
                <Button
                  type="button"
                  className="min-h-11"
                  onClick={() => {
                    setQueryText("");
                    void navigate({ to: "/tailor", search: {} });
                  }}
                >
                  Reset filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No outfit projects yet"
              description="Start with your fabric, preview up to four outfit styles, and pick the one you like. Sharing it with a tailor is up to you."
              action={
                <Button asChild className="min-h-11">
                  <Link to="/tailor/new">Start your first outfit</Link>
                </Button>
              }
            />
          )
        ) : (
          <>
            <ul className="project-grid">
              {projects.data.items.map((project) => (
                <li key={project.id}>
                  <ProjectCard
                    project={project}
                    onArchive={(p) => {
                      void (async () => {
                        const detail = await tailorApi.getProject(p.id);
                        await tailorApi.archiveProject(
                          p.id,
                          {
                            expectedProjectVersion: detail.project.version,
                            archived: p.status !== "archived",
                          },
                          `archive-${p.id}-${detail.project.version}`,
                        );
                        await projects.refetch();
                      })().catch(() => void projects.refetch());
                    }}
                  />
                </li>
              ))}
            </ul>
            {projects.data.nextCursor ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  void navigate({
                    to: "/tailor",
                    search: (prev) => ({
                      ...prev,
                      ...(projects.data.nextCursor ? { cursor: projects.data.nextCursor } : {}),
                    }),
                  })
                }
              >
                Load more outfit projects
              </Button>
            ) : null}
          </>
        )}
      </div>
    </TailorAppShell>
  );
}
