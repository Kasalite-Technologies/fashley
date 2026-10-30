import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TailorAppShell } from "@/components/tailor/TailorAppShell";
import { BriefDocument } from "@/components/tailor/BriefDocument";
import { ShareBriefDialog, type ShareSelection } from "@/components/tailor/ShareBriefDialog";
import { PageError } from "@/components/tailor/status";
import { IdempotencyKeyKeeper, tailorApi, tailorKeys } from "@/lib/tailor/client";

export const Route = createFileRoute("/tailor/projects/$projectId/brief")({
  validateSearch: (search: Record<string, unknown>): { briefId?: string } =>
    typeof search["briefId"] === "string" ? { briefId: search["briefId"] } : {},
  head: () => ({
    meta: [{ title: "Tailoring brief | Fashley" }, { name: "robots", content: "noindex" }],
  }),
  component: BriefPage,
});

const PRINT_CSS = `
@media print {
  body * { visibility: hidden; }
  [data-brief-document], [data-brief-document] * { visibility: visible; }
  [data-brief-document] { position: absolute; inset: 0; background: #fff; color: #000; padding: 16mm; }
  [data-print-hide] { display: none !important; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  figure { page-break-inside: avoid; }
}
`;

export function BriefPage() {
  const { projectId } = Route.useParams();
  const { briefId: selectedBriefId } = Route.useSearch();
  const queryClient = useQueryClient();
  const keeper = useRef(new IdempotencyKeyKeeper());
  const [shareOpen, setShareOpen] = useState(false);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const me = useQuery({ queryKey: tailorKeys.me(), queryFn: () => tailorApi.me(), retry: false });
  const userId = me.data?.user.id ?? "current";
  const project = useQuery({
    queryKey: tailorKeys.project(userId, projectId),
    queryFn: () => tailorApi.getProject(projectId),
    retry: false,
  });
  const briefId = selectedBriefId ?? project.data?.project.latestBriefId ?? undefined;
  const brief = useQuery({
    queryKey: tailorKeys.brief(userId, briefId ?? "none"),
    queryFn: () => tailorApi.getBrief(briefId as string),
    enabled: Boolean(briefId),
    retry: false,
    refetchInterval: shareOpen ? false : 10000,
  });
  const shares = useQuery({
    queryKey: tailorKeys.shares(userId, briefId ?? "none"),
    queryFn: () => tailorApi.listShares(briefId as string),
    enabled: Boolean(briefId),
    retry: false,
  });

  const createShare = useMutation({
    mutationFn: async (selection: ShareSelection) => {
      if (!brief.data || !me.data) throw new Error("Brief not ready");
      const consent = await tailorApi.createConsent(
        { purpose: "tailor_share", policyVersion: me.data.policy.version, projectId },
        keeper.current.keyFor("share-consent"),
      );
      keeper.current.clear("share-consent");
      return tailorApi.createShare(
        brief.data.id,
        { expectedContentHash: brief.data.contentHash, ...selection, consentId: consent.id },
        keeper.current.keyFor("create-share"),
      );
    },
    onSuccess: (result) => {
      keeper.current.clear("create-share");
      setShareError(null);
      setReviewUrl(result.reviewUrl);
      void queryClient.invalidateQueries({
        queryKey: tailorKeys.shares(userId, briefId ?? "none"),
      });
    },
    onError: () =>
      setShareError(
        "The review link could not be created. If a link was created before this attempt, it cannot be shown again. Revoke the earlier grant below and create a new link.",
      ),
  });

  const revoke = useMutation({
    mutationFn: (shareId: string) =>
      tailorApi.revokeShare(shareId, keeper.current.keyFor(`revoke-${shareId}`)),
    onSuccess: (_data, shareId) => {
      keeper.current.clear(`revoke-${shareId}`);
      void shares.refetch();
    },
  });

  return (
    <TailorAppShell title="Tailoring brief" projectTitle={project.data?.project.title}>
      <style>{PRINT_CSS}</style>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2" data-print-hide>
          <Button asChild variant="outline" className="min-h-11">
            <Link
              to="/tailor/projects/$projectId"
              params={{ projectId }}
              search={{ step: "handoff" }}
            >
              Back to project
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link
              to="/tailor/projects/$projectId/history"
              params={{ projectId }}
              search={{ step: "overview" }}
            >
              History
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => window.print()}
          >
            Print or save PDF
          </Button>
          {brief.data?.state === "finalized" ? (
            <Button
              type="button"
              className="min-h-11"
              onClick={() => {
                setReviewUrl(null);
                setShareOpen(true);
              }}
            >
              Share for review
            </Button>
          ) : null}
        </div>
        {brief.data && brief.data.state !== "finalized" ? (
          <p className="text-sm text-muted-foreground">
            This brief is {brief.data.state}. Only a current finalized brief can be shared.
          </p>
        ) : null}

        {project.isPending || brief.isPending ? (
          <Skeleton className="h-64" />
        ) : project.isError ? (
          <PageError error={project.error} onRetry={() => void project.refetch()} />
        ) : !briefId ? (
          <p className="text-sm">
            No brief has been finalized for this project yet. Compile and finalize one in the Brief
            step of the workspace.
          </p>
        ) : brief.isError ? (
          <PageError error={brief.error} onRetry={() => void brief.refetch()} />
        ) : brief.data ? (
          <div data-brief-document className="mx-auto max-w-3xl">
            <BriefDocument brief={brief.data} assetUrl={(id) => tailorApi.ownerAssetUrl(id)} />
            <p className="mt-6 text-xs">
              Brief {brief.data.briefNumber} · Revision {brief.data.revisionId} ·{" "}
              {brief.data.content.disclaimer}
            </p>
          </div>
        ) : null}

        <section aria-label="Review links" className="space-y-3" data-print-hide>
          <h2 className="text-xl">Review links</h2>
          {shares.isPending ? (
            <Skeleton className="h-20" />
          ) : shares.isError ? (
            <PageError error={shares.error} onRetry={() => void shares.refetch()} />
          ) : shares.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No review links have been created for this brief.
            </p>
          ) : (
            <ul className="space-y-3">
              {shares.data.items.map((grant) => (
                <li
                  key={grant.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm"
                >
                  <span>
                    Created {new Date(grant.createdAt).toLocaleString()} · Expires{" "}
                    {new Date(grant.expiresAt).toLocaleString()} ·{" "}
                    {grant.revokedAt ? "Revoked" : "Active"} · Measurements{" "}
                    {grant.includeMeasurements ? "included" : "not included"}
                  </span>
                  {!grant.revokedAt ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={revoke.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Revoke this review link? Anyone using it will lose access straight away.",
                          )
                        )
                          revoke.mutate(grant.id);
                      }}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">
            Links that have expired or been revoked cannot be used. The original link text is never
            stored in this list.
          </p>
        </section>
      </div>

      {brief.data ? (
        <ShareBriefDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          briefNumber={brief.data.briefNumber}
          assets={brief.data.assets}
          measurementCount={brief.data.content.measurements.length}
          reviewUrl={reviewUrl}
          busy={createShare.isPending}
          error={shareError}
          onCreate={(selection) => createShare.mutate(selection)}
        />
      ) : null}
    </TailorAppShell>
  );
}
