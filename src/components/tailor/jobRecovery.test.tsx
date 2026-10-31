import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jobSchema, type Job } from "@/lib/tailor/contracts";
import { JobStatusPanel } from "./panels";
import {
  canRetryJob,
  pollIntervalForJob,
  pollUploadUntilSettled,
  seededJobIds,
  withoutSelectedConcept,
} from "./jobRecovery";
import { emptyProjectInput } from "@/lib/tailor/contracts";
import type { UploadStatus } from "@/lib/tailor/client/api";

afterEach(() => cleanup());

const NOW = "2026-10-30T10:00:00.000Z";
function makeJob(overrides: Partial<Job> = {}): Job {
  return jobSchema.parse({
    id: "job_test_1",
    projectId: "prj_test_1",
    revisionId: "rev_test_1",
    type: "generate_concept",
    state: "queued",
    stage: "validating",
    attemptCount: 1,
    createdAt: NOW,
    updatedAt: NOW,
    retryAfterMs: null,
    result: null,
    error: null,
    ...overrides,
  });
}

describe("jobRecovery helpers", () => {
  it("stops polling on terminal jobs and polls active ones", () => {
    expect(pollIntervalForJob(undefined)).toBe(false);
    expect(pollIntervalForJob(makeJob({ state: "completed" }))).toBe(false);
    expect(pollIntervalForJob(makeJob({ state: "failed" }))).toBe(false);
    expect(pollIntervalForJob(makeJob({ state: "queued" }))).toBe(2000);
    expect(pollIntervalForJob(makeJob({ state: "running" }))).toBe(2000);
  });

  it("seeds restored jobs discriminated by type (reload recovery)", () => {
    expect(seededJobIds(null)).toEqual({ activeJobId: null, analyzeJobId: null, briefJobId: null });
    expect(seededJobIds(makeJob({ type: "generate_concept" })).activeJobId).toBe("job_test_1");
    expect(seededJobIds(makeJob({ type: "analyze_fabric" })).analyzeJobId).toBe("job_test_1");
    expect(seededJobIds(makeJob({ type: "assemble_brief" })).briefJobId).toBe("job_test_1");
  });

  it("allows retry only for failed/cancelled retryable jobs (server alignment)", () => {
    const err = { code: "PROVIDER_UNAVAILABLE", message: "Down.", retryable: true };
    expect(canRetryJob(makeJob({ state: "failed", error: err }))).toBe(true);
    expect(canRetryJob(makeJob({ state: "cancelled", error: err }))).toBe(true);
    expect(canRetryJob(makeJob({ state: "failed", error: { ...err, retryable: false } }))).toBe(
      false,
    );
    expect(canRetryJob(makeJob({ state: "needs_attention", error: err }))).toBe(false);
    expect(canRetryJob(makeJob({ state: "retry_wait", error: err }))).toBe(false);
    expect(canRetryJob(makeJob({ state: "failed", error: null }))).toBe(false);
  });

  it("clears a stale concept selection without mutating other input", () => {
    const input = { ...emptyProjectInput("T", "UTC"), selectedConceptAssetId: "ast_1" };
    const cleared = withoutSelectedConcept(input);
    expect(cleared.selectedConceptAssetId).toBeNull();
    expect(cleared.overview.title).toBe("T");
    expect(withoutSelectedConcept(cleared)).toBe(cleared);
  });

  it("polls an upload until ready", async () => {
    const statuses: UploadStatus[] = [
      { uploadId: "upl_1", status: "validating", asset: null, error: null },
      {
        uploadId: "upl_1",
        status: "ready",
        asset: null,
        error: null,
      },
    ];
    const getStatus = vi.fn(async () => statuses.shift() as UploadStatus);
    const sleep = vi.fn(async () => undefined);
    const result = await pollUploadUntilSettled(getStatus, {
      initial: { uploadId: "upl_1", status: "pending", asset: null, error: null },
      sleep,
    });
    expect(result.status).toBe("ready");
    expect(getStatus).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalled();
  });

  it("stops polling an upload on rejection and after max attempts", async () => {
    const rejected = await pollUploadUntilSettled(
      async () => ({
        uploadId: "upl_1",
        status: "rejected" as const,
        asset: null,
        error: { code: "BAD", message: "No." },
      }),
      { sleep: async () => undefined },
    );
    expect(rejected.status).toBe("rejected");
    const pending = await pollUploadUntilSettled(
      async () => ({ uploadId: "upl_1", status: "pending" as const, asset: null, error: null }),
      { maxAttempts: 3, sleep: async () => undefined },
    );
    expect(pending.status).toBe("pending");
  });
});

describe("JobStatusPanel retry visibility", () => {
  it("shows Retry for a failed retryable job and forwards the acknowledge flag", () => {
    const onRetry = vi.fn();
    render(
      <JobStatusPanel
        job={makeJob({
          state: "failed",
          error: { code: "PROVIDER_UNAVAILABLE", message: "Provider down.", retryable: true },
        })}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText(/Provider down/)).toBeInTheDocument();
    expect(screen.getByText(/Generate concept/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry job" }));
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ id: "job_test_1" }),
      expect.any(String),
      false,
    );
  });

  it("asks for cost acknowledgement only for ambiguous provider results", () => {
    const onRetry = vi.fn();
    render(
      <JobStatusPanel
        job={makeJob({
          state: "failed",
          error: { code: "AMBIGUOUS_PROVIDER_RESULT", message: "Unclear.", retryable: true },
        })}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /acknowledge possible extra cost/ }));
    expect(onRetry).toHaveBeenCalledWith(expect.anything(), expect.any(String), true);
  });

  it("hides Retry for non-retryable failures and states why", () => {
    render(
      <JobStatusPanel
        job={makeJob({
          state: "failed",
          error: { code: "INVALID_INPUT", message: "Bad input.", retryable: false },
        })}
        onRetry={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: /Retry/ })).not.toBeInTheDocument();
    expect(screen.getByText(/cannot be retried/)).toBeInTheDocument();
  });
});
