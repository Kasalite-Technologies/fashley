import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TailorAppShell } from "@/components/tailor/TailorAppShell";
import { EvidenceTimeline } from "@/components/tailor/panels";
import { PageError } from "@/components/tailor/status";
import { tailorApi, tailorKeys } from "@/lib/tailor/client";

export const Route = createFileRoute("/tailor/projects/$projectId/history")({
  head: () => ({
    meta: [{ title: "Project history | Fashley" }, { name: "robots", content: "noindex" }],
  }),
  component: HistoryPage,
});

export function HistoryPage() {
  const { projectId } = Route.useParams();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const me = useQuery({ queryKey: tailorKeys.me(), queryFn: () => tailorApi.me(), retry: false });
  const userId = me.data?.user.id ?? "current";
  const project = useQuery({
    queryKey: tailorKeys.project(userId, projectId),
    queryFn: () => tailorApi.getProject(projectId),
    retry: false,
  });
  const history = useQuery({
    queryKey: tailorKeys.history(userId, projectId, cursor),
    queryFn: () => tailorApi.getHistory(projectId, { ...(cursor ? { cursor } : {}), limit: 20 }),
    retry: false,
  });

  return (
    <TailorAppShell title="Project history" projectTitle={project.data?.project.title}>
      <div className="max-w-3xl space-y-6">
        <Button asChild variant="outline" className="min-h-11">
          <Link
            to="/tailor/projects/$projectId"
            params={{ projectId }}
            search={{ step: "overview" }}
          >
            Back to project
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          This timeline shows saved input versions, briefs, jobs and human review actions. Review
          links and private prompts are never shown here.
        </p>
        {history.isPending ? (
          <Skeleton className="h-48" />
        ) : history.isError ? (
          <PageError error={history.error} onRetry={() => void history.refetch()} />
        ) : (
          <>
            <EvidenceTimeline items={history.data.items} />
            {history.data.nextCursor ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setCursor(history.data.nextCursor ?? undefined)}
              >
                Load more history
              </Button>
            ) : null}
          </>
        )}
      </div>
    </TailorAppShell>
  );
}
