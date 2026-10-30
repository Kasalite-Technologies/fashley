import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BriefDocument } from "@/components/tailor/BriefDocument";
import {
  ReviewActionPanel,
  type ReviewActionSubmission,
} from "@/components/tailor/ReviewActionPanel";
import { PageError } from "@/components/tailor/status";
import { IdempotencyKeyKeeper, TailorApiError, tailorApi, tailorKeys } from "@/lib/tailor/client";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Tailoring brief review | Fashley" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ReviewRoute,
});

function ReviewRoute() {
  const pathname = useLocation({ select: (l) => l.pathname });
  if (pathname !== "/review") return <Outlet />;
  return <ReviewPage />;
}

export function ReviewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const keeper = useRef(new IdempotencyKeyKeeper());
  const [receipt, setReceipt] = useState<string | null>(null);
  const [exited, setExited] = useState(false);

  const session = useQuery({
    queryKey: tailorKeys.reviewSession(),
    queryFn: () => tailorApi.reviewSession(),
    retry: false,
  });

  const action = useMutation({
    mutationFn: (submission: ReviewActionSubmission) => {
      if (!session.data) throw new Error("No review session");
      return tailorApi.reviewAction(
        {
          briefId: session.data.brief.briefId,
          expectedContentHash: session.data.brief.contentHash,
          ...submission,
        },
        keeper.current.keyFor(`review-${submission.action}`),
      );
    },
    onSuccess: (result, submission) => {
      keeper.current.clear(`review-${submission.action}`);
      setReceipt(
        `${result.action.action.replace(/_/g, " ")} recorded for brief ${session.data?.brief.briefNumber} at ${new Date(result.action.createdAt).toLocaleString()}. The name was recorded as stated, not verified.`,
      );
      void queryClient.invalidateQueries({ queryKey: tailorKeys.reviewSession() });
    },
    onError: (e) => {
      if (
        e instanceof TailorApiError &&
        (e.code === "SHARE_REVOKED" ||
          e.code === "SHARE_EXPIRED" ||
          e.code === "INVALID_REVIEW_CREDENTIAL")
      ) {
        queryClient.removeQueries({ queryKey: tailorKeys.reviewSession() });
      }
    },
  });

  const logout = useMutation({
    mutationFn: () => tailorApi.reviewLogout(),
    onSettled: () => {
      queryClient.removeQueries({ queryKey: tailorKeys.reviewSession() });
      setExited(true);
    },
  });

  if (exited) {
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-3xl">Review closed</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This brief is no longer open in this browser. Use the customer link again if you need to
          reopen it.
        </p>
        <Button type="button" className="mt-6 min-h-11" onClick={() => void navigate({ to: "/" })}>
          Go to Fashley home
        </Button>
      </main>
    );
  }

  const sessionGone =
    session.isError &&
    session.error instanceof TailorApiError &&
    ["SHARE_REVOKED", "SHARE_EXPIRED", "INVALID_REVIEW_CREDENTIAL"].includes(session.error.code);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm font-semibold">Fashley</p>
      {session.isPending ? (
        <Skeleton className="mt-6 h-64" />
      ) : sessionGone ? (
        <div className="mt-6 space-y-3">
          <h1 className="text-3xl">This review link is no longer active</h1>
          <p className="text-sm text-muted-foreground">
            Ask the customer for a current link. Nothing from the brief is shown here.
          </p>
        </div>
      ) : session.isError ? (
        <div className="mt-6">
          <PageError error={session.error} onRetry={() => void session.refetch()} />
        </div>
      ) : session.data ? (
        <div className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl">Brief {session.data.brief.briefNumber} for review</h1>
            <p className="text-sm text-muted-foreground">
              This link is active until {new Date(session.data.grant.expiresAt).toLocaleString()}.
              This link grants access. The sender has not verified your identity.
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              Exit review
            </Button>
          </header>
          <BriefDocument
            redacted={session.data.brief}
            assetUrl={(id) => tailorApi.reviewAssetUrl(id)}
          />
          {action.isError && !sessionGone ? <PageError error={action.error} /> : null}
          <ReviewActionPanel
            session={session.data}
            measurements={session.data.brief.measurements}
            busy={action.isPending}
            receipt={receipt}
            onAction={(submission) => action.mutate(submission)}
          />
        </div>
      ) : null}
    </main>
  );
}
