import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Job } from "@/lib/tailor/contracts";
import { IdempotencyKeyKeeper } from "@/lib/tailor/client";
import { useRef } from "react";
import { canRetryJob, retryNeedsCostAcknowledgement } from "./jobRecovery";

const JOB_TYPE_LABEL: Record<Job["type"], string> = {
  analyze_fabric: "Analyze fabric",
  generate_concept: "Generate concept",
  assemble_brief: "Compile brief",
};

const STAGE_LABEL: Record<string, string> = {
  validating: "Validating inputs",
  segmenting: "Finding fabric regions",
  understanding: "Reviewing fabric",
  generating: "Generating concept",
  assembling: "Assembling brief",
  persisting: "Saving result",
};

export function JobStatusPanel({
  job,
  onCancel,
  onRetry,
}: {
  job: Job;
  onCancel?: (job: Job, key: string) => void;
  onRetry?: (job: Job, key: string, acknowledge: boolean) => void;
}) {
  const keeper = useRef(new IdempotencyKeyKeeper());
  const terminal = ["completed", "failed", "cancelled"].includes(job.state);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Job status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p role="status" className="text-sm">
          {JOB_TYPE_LABEL[job.type]} · State: <strong>{job.state.replace(/_/g, " ")}</strong>
          {job.stage ? <> · Stage: {STAGE_LABEL[job.stage] ?? job.stage}</> : null}
          <> · Attempts: {job.attemptCount}</>
        </p>
        <p className="text-sm text-muted-foreground">
          Started {new Date(job.createdAt).toLocaleString()}. No completion percentage is shown
          because the service does not report one.
        </p>
        {job.error ? (
          <Alert variant="destructive" role="alert">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Job needs attention</AlertTitle>
            <AlertDescription>{job.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {!terminal && onCancel ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => onCancel(job, keeper.current.keyFor(`cancel-${job.id}`))}
            >
              Cancel job
            </Button>
          ) : null}
          {canRetryJob(job) && onRetry ? (
            <Button
              type="button"
              className="min-h-11"
              onClick={() =>
                onRetry(
                  job,
                  keeper.current.keyFor(`retry-${job.id}`),
                  retryNeedsCostAcknowledgement(job),
                )
              }
            >
              {retryNeedsCostAcknowledgement(job)
                ? "Retry and acknowledge possible extra cost"
                : "Retry job"}
            </Button>
          ) : null}
        </div>
        {canRetryJob(job) && !onRetry ? (
          <p className="text-sm text-muted-foreground">
            Retry is not available here. Return to the step that started this job.
          </p>
        ) : null}
        {(job.state === "failed" || job.state === "cancelled") && !canRetryJob(job) ? (
          <p className="text-sm text-muted-foreground">
            This job cannot be retried. Start the step again to create a new job.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ConceptViewer({
  conceptAssetId,
  fabricAssetId,
  frozenLabels,
  assetUrl,
}: {
  conceptAssetId: string | null;
  fabricAssetId: string | null;
  frozenLabels: string[];
  assetUrl: (assetId: string) => string;
}) {
  if (!conceptAssetId) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">
            No concept has been generated for the saved inputs yet.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Concept preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <figure>
            <img
              src={assetUrl(conceptAssetId)}
              alt="Generated garment concept illustration"
              className="aspect-square w-full rounded-md border object-cover"
            />
            <figcaption className="mt-2 text-sm text-muted-foreground">
              Generated concept
            </figcaption>
          </figure>
          {fabricAssetId ? (
            <figure>
              <img
                src={assetUrl(fabricAssetId)}
                alt="Your confirmed fabric swatch"
                className="aspect-square w-full rounded-md border object-cover"
              />
              <figcaption className="mt-2 text-sm text-muted-foreground">
                Your fabric swatch
              </figcaption>
            </figure>
          ) : null}
        </div>
        <Alert>
          <AlertTitle>Illustrative preview</AlertTitle>
          <AlertDescription>
            Illustrative preview. It is not a guarantee of fabric scale, drape or fit. Your tailor
            must confirm fit and construction.
          </AlertDescription>
        </Alert>
        {frozenLabels.length ? (
          <div>
            <h3 className="text-sm font-semibold">Design choices used for this concept</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {frozenLabels.map((label) => (
                <li key={label}>
                  <Badge variant="outline">{label}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              These labels come from the frozen inputs for this concept. Changing the controls above
              does not relabel this result.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function EvidenceTimeline({
  items,
}: {
  items: Array<{
    id: string;
    kind: string;
    createdAt: string;
    summary: string;
    status?: string | undefined;
  }>;
}) {
  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No history yet. Save and freeze a draft to create the first input revision.
      </p>
    );
  }
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`} className="flex gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{item.summary}</p>
            <p className="text-xs text-muted-foreground">
              {item.kind} · {new Date(item.createdAt).toLocaleString()}
              {item.status ? ` · ${item.status}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
