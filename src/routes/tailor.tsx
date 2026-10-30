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
    meta: [{ title: "Your tailoring projects | Fashley" }, { name: "robots", content: "noindex" }],
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
    <TailorAppShell title="Your tailoring projects">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild className="min-h-11">
            <Link to="/tailor/new">New project</Link>
          </Button>
          {isFixtureMode ? (
            <p className="text-xs text-muted-foreground">Fixture mode: synthetic test data only.</p>
          ) : null}
        </div>

        <form
          className="grid gap-4 sm:grid-cols-3"
          onSubmit={(e) => e.preventDefault()}
          aria-label="Filter projects"
        >
          <div className="space-y-1.5">
            <Label htmlFor="project-search">Search projects</Label>
            <Input
              id="project-search"
              value={queryText}
              maxLength={100}
              onChange={(e) => setQueryText(e.target.value)}
              className="min-h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-status">Project status</Label>
            <select
              id="project-status"
              value={search.status}
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(e) =>
                void navigate({
                  to: "/tailor",
                  search: (prev) => {
                    const { cursor: _cursor, ...rest } = prev;
                    return { ...rest, status: e.target.value };
                  },
                })
              }
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-review-status">Review status</Label>
            <select
              id="project-review-status"
              value={search.reviewStatus}
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(e) =>
                void navigate({
                  to: "/tailor",
                  search: (prev) => {
                    const { cursor: _cursor, ...rest } = prev;
                    return { ...rest, reviewStatus: e.target.value };
                  },
                })
              }
            >
              <option value="all">All</option>
              <option value="awaiting_review">Awaiting review</option>
              <option value="changes_requested">Changes requested</option>
              <option value="design_approved">Design approved</option>
              <option value="accepted">Accepted</option>
            </select>
          </div>
        </form>

        {me.data ? (
          <p className="text-sm text-muted-foreground">
            Pilot credits: {me.data.credits.available} available, {me.data.credits.reserved}{" "}
            reserved. Credits are part of this pilot. There is no top-up in this version.
          </p>
        ) : null}

        {projects.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading projects">
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
        ) : projects.isError ? (
          <PageError error={projects.error} onRetry={() => void projects.refetch()} />
        ) : projects.data.items.length === 0 ? (
          search.q || search.status !== "all" || search.reviewStatus !== "all" ? (
            <EmptyState
              title="No projects match these filters"
              description="Try a different search, or reset the filters to see all of your projects."
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
              title="No projects yet"
              description="Start a tailoring brief with your fabric, design choices and measurements, then share a frozen version with your tailor."
              action={
                <Button asChild className="min-h-11">
                  <Link to="/tailor/new">Create your first brief</Link>
                </Button>
              }
            />
          )
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                Load more projects
              </Button>
            ) : null}
          </>
        )}
      </div>
    </TailorAppShell>
  );
}
