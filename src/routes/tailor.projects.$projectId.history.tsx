import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TailorAppShell } from "@/components/tailor/TailorAppShell";
import { EvidenceTimeline, JobStatusPanel } from "@/components/tailor/panels";
import { PageError } from "@/components/tailor/status";
import { tailorApi, tailorKeys } from "@/lib/tailor/client";
import type { Job } from "@/lib/tailor/contracts";

export const Route = createFileRoute("/tailor/projects/$projectId/history")({
  head: () => ({
    meta: [{ title: "Project history | Fashley" }, { name: "robots", content: "noindex" }],
  }),
  component: HistoryPage,
});

function HistoryJobPanel({ jobId, userId }: { jobId: string; userId: string }) {
  const [actionError, setActionError] = useState<unknown>(null);
  const job = useQuery({
    queryKey: tailorKeys.job(userId, jobId),
    queryFn: () => tailorApi.getJob(jobId),
    retry: false,
  });
  if (job.isPending) return <Skeleton className="h-24" />;
  if (job.isError) return <PageError error={job.error} onRetry={() => void job.refetch()} />;
  if (actionError) return <PageError error={actionError} />;
  return (
    <JobStatusPanel
      job={job.data}
      onCancel={(j: Job, key: string) => {
        void tailorApi
          .cancelJob(j.id, key)
          .then(() => job.refetch())
          .catch((e) => setActionError(e));
      }}
      onRetry={(j: Job, key: string, acknowledge: boolean) => {
        void tailorApi
          .retryJob(j.id, acknowledge ? { acknowledgePossibleProviderCost: true } : {}, key)
          .then(() => job.refetch())
          .catch((e) => setActionError(e));
      }}
    />
  );
}

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
            {history.data.items
              .filter((item) => item.kind === "job")
              .map((item) => (
                <HistoryJobPanel key={item.id} jobId={item.id} userId={userId} />
              ))}
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
