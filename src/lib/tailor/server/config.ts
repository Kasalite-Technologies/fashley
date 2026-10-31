export interface TailorConfig {
  policyVersion: string;
  personRetentionDays: number;
  jobQuotes: { analyze_fabric: number; generate_concept: number; assemble_brief: number };
  capabilities: { personUpload: boolean; manualCrop: boolean };
}
export const defaultConfig: TailorConfig = {
  policyVersion: "tailor-policy-v1",
  personRetentionDays: 7,
  jobQuotes: { analyze_fabric: 0, generate_concept: 0, assemble_brief: 0 },
  capabilities: { personUpload: false, manualCrop: true },
};

/** Provider/media adapters: interfaces only. Unconfigured implementations fail closed; no fake results. */
export interface MetaAdapter {
  segmentFabric(input: unknown): Promise<unknown>;
  understandFabric(input: unknown): Promise<unknown>;
  generateConcept(input: unknown): Promise<unknown>;
  assembleBrief(input: unknown): Promise<unknown>;
}
export interface WorkflowAdapter {
  dispatch(jobId: string): Promise<{ workflowId: string }>;
}
export interface MediaStore {
  putPrivate(key: string, bytes: Uint8Array): Promise<void>;
  getPrivate(key: string): Promise<Uint8Array>;
  deletePrivate(key: string): Promise<void>;
}
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** Crops a normalized rect from a source image and returns JPEG bytes. */
export interface ImageCropper {
  crop(input: {
    bytes: Uint8Array;
    mime: string;
    widthPx: number;
    heightPx: number;
    rect: NormalizedRect;
  }): Promise<Uint8Array>;
}
import { err } from "./errors";
const unavailable = () => {
  throw err("PROVIDER_UNAVAILABLE", "Provider is not configured.");
};
export class UnconfiguredMetaAdapter implements MetaAdapter {
  segmentFabric = unavailable as MetaAdapter["segmentFabric"];
  understandFabric = unavailable as MetaAdapter["understandFabric"];
  generateConcept = unavailable as MetaAdapter["generateConcept"];
  assembleBrief = unavailable as MetaAdapter["assembleBrief"];
}
export class UnconfiguredWorkflowAdapter implements WorkflowAdapter {
  async dispatch(): Promise<{ workflowId: string }> {
    throw err("FEATURE_UNAVAILABLE", "Workflow binding is not configured.");
  }
}
export class UnconfiguredImageCropper implements ImageCropper {
  async crop(): Promise<Uint8Array> {
    throw err("FEATURE_UNAVAILABLE", "Image cropping is not configured.");
  }
}
export class UnconfiguredMediaStore implements MediaStore {
  putPrivate = unavailable as MediaStore["putPrivate"];
  getPrivate = unavailable as MediaStore["getPrivate"];
  deletePrivate = unavailable as MediaStore["deletePrivate"];
}
