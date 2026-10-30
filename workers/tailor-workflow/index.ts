import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { adaptD1, secretResolver, type D1Like } from "../../src/lib/tailor/server/cloudflare";
import { createR2MediaStore, type R2BucketLike } from "../../src/lib/tailor/server/media";
import { createMetaAdapter } from "../../src/lib/tailor/server/meta";
import { runJob } from "../../src/lib/tailor/server/jobs";

/**
 * Companion Workflow Worker for Fashley Tailor durable jobs.
 * Deploy separately (name: fashley-tailor-workflow) before the main Worker's
 * TAILOR_WORKFLOW binding can dispatch. Not yet deployed: job creation in the
 * main Worker fails closed with FEATURE_UNAVAILABLE until this is live.
 */
interface TailorWorkflowEnv {
  DB: D1Like;
  TAILOR_MEDIA: R2BucketLike;
  META_API_KEY?: string | { get(): Promise<string | null> };
}

export class TailorWorkflow extends WorkflowEntrypoint<TailorWorkflowEnv, { jobId: string }> {
  async run(event: WorkflowEvent<{ jobId: string }>, step: WorkflowStep) {
    const jobId = event.payload.jobId;
    await step.do("run tailor job", async () => {
      const db = adaptD1(this.env.DB);
      const media = createR2MediaStore(this.env.TAILOR_MEDIA);
      const meta = createMetaAdapter(secretResolver(this.env.META_API_KEY));
      await runJob(db, { meta, media }, jobId);
      return { jobId };
    });
    return { jobId };
  }
}

export default {
  fetch: () => new Response("Not found", { status: 404 }),
};
