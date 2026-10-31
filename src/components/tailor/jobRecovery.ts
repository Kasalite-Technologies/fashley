import type { Job, ProjectInput } from "@/lib/tailor/contracts";
import type { UploadStatus } from "@/lib/tailor/client/api";

export const TERMINAL_JOB_STATES: readonly Job["state"][] = ["completed", "failed", "cancelled"];

export function isTerminalJob(job: Job | undefined | null): boolean {
  return Boolean(job && TERMINAL_JOB_STATES.includes(job.state));
}

/** Shared poll: stop on terminal data, back off while the tab is hidden. */
export function pollIntervalForJob(job: Job | undefined): number | false {
  if (!job || isTerminalJob(job)) return false;
  return typeof document !== "undefined" && document.hidden ? 10000 : 2000;
}

/** Retry mirrors the server: only failed/cancelled jobs whose error is retryable. */
export function canRetryJob(job: Job): boolean {
  return (job.state === "failed" || job.state === "cancelled") && job.error?.retryable === true;
}

export function retryNeedsCostAcknowledgement(job: Job): boolean {
  return job.error?.code === "AMBIGUOUS_PROVIDER_RESULT";
}

export interface SeededJobIds {
  activeJobId: string | null;
  analyzeJobId: string | null;
  briefJobId: string | null;
}

/** Discriminate a restored latestJob by type so each step resumes its own job. */
export function seededJobIds(latestJob: Job | null | undefined): SeededJobIds {
  if (!latestJob) return { activeJobId: null, analyzeJobId: null, briefJobId: null };
  if (latestJob.type === "assemble_brief")
    return { activeJobId: null, analyzeJobId: null, briefJobId: latestJob.id };
  if (latestJob.type === "analyze_fabric")
    return { activeJobId: null, analyzeJobId: latestJob.id, briefJobId: null };
  return { activeJobId: latestJob.id, analyzeJobId: null, briefJobId: null };
}

export function withoutSelectedConcept(input: ProjectInput): ProjectInput {
  return input.selectedConceptAssetId ? { ...input, selectedConceptAssetId: null } : input;
}

const SETTLED_UPLOAD: readonly UploadStatus["status"][] = ["ready", "rejected", "expired"];

/** Poll an upload until it settles or attempts run out. Sleep is injectable for tests. */
export async function pollUploadUntilSettled(
  getStatus: () => Promise<UploadStatus>,
  options: {
    initial?: UploadStatus;
    maxAttempts?: number;
    intervalMs?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<UploadStatus> {
  const maxAttempts = options.maxAttempts ?? 15;
  const intervalMs = options.intervalMs ?? 2000;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let current = options.initial;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (current && SETTLED_UPLOAD.includes(current.status)) return current;
    if (attempt > 0 || !current) current = await getStatus();
    if (SETTLED_UPLOAD.includes(current.status)) return current;
    if (attempt < maxAttempts - 1) await sleep(intervalMs);
  }
  if (!current) current = await getStatus();
  return current;
}
