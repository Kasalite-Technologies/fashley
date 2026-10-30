import type { MetaAdapter } from "./config";
import { err } from "./errors";

export const META_MODELS = {
  segment: "sam-3.1",
  understand: "muse-spark-1.3",
  generate: "muse-image-1.0",
} as const;
export const META_PROMPT_VERSIONS = {
  segment: "sam-fabric-v1",
  understand: "fabric-understanding-v1",
  generate: "concept-v1",
} as const;

export interface MetaSegmentInput {
  imageDataUrl: string;
  prompt: string;
}
export interface MetaSegmentResult {
  providerRequestId: string | null;
  outputText: string;
}
export interface MetaUnderstandInput {
  imageDataUrl: string;
  prompt: string;
}
export type MetaUnderstandResult = MetaSegmentResult;
export interface MetaGenerateInput {
  prompt: string;
  imageDataUrl?: string;
}
export interface MetaGenerateResult {
  providerRequestId: string | null;
  modelId: string;
  imageBase64: string;
}

const BASE_URL = "https://api.meta.ai/v1";
const unavailable = () => err("PROVIDER_UNAVAILABLE", "Meta provider is unavailable.");

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function requiredText(v: unknown): string {
  if (typeof v !== "string" || !v.trim()) throw unavailable();
  return v;
}
function parseTextInput(input: unknown): MetaSegmentInput {
  if (!isRecord(input)) throw unavailable();
  return {
    imageDataUrl: requiredText(input["imageDataUrl"]),
    prompt: requiredText(input["prompt"]),
  };
}
function providerRequestId(body: unknown): string | null {
  return isRecord(body) && typeof body["id"] === "string" ? body["id"] : null;
}
function extractOutputText(body: unknown): string | null {
  if (!isRecord(body)) return null;
  if (typeof body["output_text"] === "string") return body["output_text"];
  if (!Array.isArray(body["output"])) return null;
  for (const item of body["output"]) {
    if (!isRecord(item) || !Array.isArray(item["content"])) continue;
    for (const part of item["content"]) {
      if (isRecord(part) && part["type"] === "output_text" && typeof part["text"] === "string")
        return part["text"];
    }
  }
  return null;
}
function extractImageBase64(body: unknown): string | null {
  if (!isRecord(body) || !Array.isArray(body["output"])) return null;
  for (const item of body["output"]) {
    if (
      isRecord(item) &&
      item["type"] === "image_generation_call" &&
      typeof item["result"] === "string" &&
      item["result"]
    )
      return item["result"];
  }
  return null;
}
function messageInput(prompt: string, imageDataUrl?: string) {
  const content: Record<string, unknown>[] = [{ type: "input_text", text: prompt }];
  if (imageDataUrl) content.push({ type: "input_image", image_url: imageDataUrl });
  return [{ type: "message", role: "user", content }];
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return `data:${mime};base64,${btoa(binary)}`;
}
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function createMetaAdapter(
  resolveApiKey: () => Promise<string | null>,
  fetchFn: typeof fetch = fetch,
): MetaAdapter {
  async function post(payload: Record<string, unknown>): Promise<unknown> {
    let key: string | null;
    try {
      key = await resolveApiKey();
    } catch {
      throw unavailable();
    }
    if (!key) throw unavailable();
    let res: Response;
    try {
      res = await fetchFn(`${BASE_URL}/responses`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      throw unavailable();
    }
    if (!res.ok) throw unavailable();
    try {
      return await res.json();
    } catch {
      throw unavailable();
    }
  }
  return {
    async segmentFabric(input: unknown): Promise<MetaSegmentResult> {
      const { imageDataUrl, prompt } = parseTextInput(input);
      const body = await post({
        model: META_MODELS.segment,
        input: messageInput(prompt, imageDataUrl),
        stream: false,
      });
      const outputText = extractOutputText(body);
      if (outputText === null) throw unavailable();
      return { providerRequestId: providerRequestId(body), outputText };
    },
    async understandFabric(input: unknown): Promise<MetaUnderstandResult> {
      const { imageDataUrl, prompt } = parseTextInput(input);
      const body = await post({
        model: META_MODELS.understand,
        input: messageInput(prompt, imageDataUrl),
      });
      const outputText = extractOutputText(body);
      if (outputText === null) throw unavailable();
      return { providerRequestId: providerRequestId(body), outputText };
    },
    async generateConcept(input: unknown): Promise<MetaGenerateResult> {
      if (!isRecord(input)) throw unavailable();
      const prompt = requiredText(input["prompt"]);
      const imageDataUrl =
        input["imageDataUrl"] === undefined || input["imageDataUrl"] === null
          ? undefined
          : requiredText(input["imageDataUrl"]);
      const body = await post({
        model: META_MODELS.generate,
        input: imageDataUrl ? messageInput(prompt, imageDataUrl) : prompt,
      });
      const imageBase64 = extractImageBase64(body);
      if (!imageBase64) throw unavailable();
      return {
        providerRequestId: providerRequestId(body),
        modelId: META_MODELS.generate,
        imageBase64,
      };
    },
    async assembleBrief(): Promise<never> {
      throw unavailable();
    },
  };
}
