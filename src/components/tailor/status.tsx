import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileWarning,
  RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { safeErrorMessage } from "@/lib/tailor/client";
import type { ReviewStatus } from "./types";

const STATUS: Record<string, { label: string; icon: typeof Clock3 }> = {
  draft: { label: "Draft", icon: CircleDashed },
  awaiting_review: { label: "Awaiting review", icon: Clock3 },
  changes_requested: { label: "Changes requested", icon: FileWarning },
  design_approved: { label: "Design approved", icon: CheckCircle2 },
  accepted: { label: "Accepted for production preparation", icon: CheckCircle2 },
  active: { label: "Active", icon: CircleDashed },
  archived: { label: "Archived", icon: CircleDashed },
  finalized: { label: "Finalized", icon: CheckCircle2 },
  superseded: { label: "Superseded", icon: FileWarning },
};

/** Status is always text plus icon, never colour alone and never a generic "verified". */
export function ProjectStatusBadge({
  status,
}: {
  status: ReviewStatus | string | null | undefined;
}) {
  if (!status) return <Badge variant="outline">No brief yet</Badge>;
  const entry = STATUS[status] ?? { label: status.replace(/_/g, " "), icon: CircleDashed };
  const Icon = entry.icon;
  return (
    <Badge variant="secondary" className="gap-1.5">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {entry.label}
    </Badge>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-10">
        <h2 className="text-xl">{title}</h2>
        <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}

export function PageError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const safe = safeErrorMessage(error);
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Could not load this page</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{safe.message}</p>
        {safe.requestId ? <p className="font-mono text-xs">Request ID: {safe.requestId}</p> : null}
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function DraftSaveStatus({
  state,
  savedAt,
}: {
  state: "idle" | "saving" | "saved" | "unsaved" | "conflict" | "error";
  savedAt?: string | null;
}) {
  const text =
    state === "saving"
      ? "Saving draft"
      : state === "saved"
        ? `Saved${savedAt ? ` at ${new Date(savedAt).toLocaleTimeString()}` : ""}`
        : state === "conflict"
          ? "Save conflict. Reload the latest draft."
          : state === "error"
            ? "Draft could not be saved."
            : state === "unsaved"
              ? "Unsaved changes"
              : "No unsaved changes";
  return (
    <p role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      {state === "saved" ? (
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      ) : state === "conflict" || state === "error" ? (
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Clock3 className="h-4 w-4" aria-hidden="true" />
      )}
      {text}
    </p>
  );
}
