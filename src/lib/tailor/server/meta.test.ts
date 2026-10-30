import { describe, expect, it } from "vitest";
import { createMetaAdapter } from "./meta";

type FetchCall = { url: string; init?: RequestInit | undefined };
function fakeFetch(body: unknown, status = 200) {
  const calls: FetchCall[] = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as typeof fetch;
  return { calls, fetchFn };
}
const key = async () => "test-secret-key";

describe("createMetaAdapter", () => {
  it("segments via POST /v1/responses with bearer auth and stream:false", async () => {
    const { calls, fetchFn } = fakeFetch({ id: "req_seg", output_text: '{"regions":[]}' });
    const meta = createMetaAdapter(key, fetchFn);
    const result = (await meta.segmentFabric({
      imageDataUrl: "data:image/png;base64,AAA",
      prompt: "fabric textile cloth material",
    })) as { providerRequestId: string | null; outputText: string };
    expect(result).toEqual({ providerRequestId: "req_seg", outputText: '{"regions":[]}' });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.meta.ai/v1/responses");
    const headers = calls[0]!.init!.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-secret-key");
    const sent = JSON.parse(String(calls[0]!.init!.body));
    expect(sent.model).toBe("sam-3.1");
    expect(sent.stream).toBe(false);
    expect(JSON.stringify(sent.input)).toContain("fabric textile cloth material");
    expect(JSON.stringify(sent.input)).toContain("input_image");
    expect(JSON.stringify(sent)).not.toContain("Authorization");
  });

  it("parses understanding output from output[] message content", async () => {
    const { calls, fetchFn } = fakeFetch({
      id: "req_und",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: '[{"key":"color","value":"red","uncertainty":"observed"}]',
            },
          ],
        },
      ],
    });
    const meta = createMetaAdapter(key, fetchFn);
    const result = (await meta.understandFabric({
      imageDataUrl: "data:image/png;base64,AAA",
      prompt: "describe fabric",
    })) as { providerRequestId: string | null; outputText: string };
    expect(result.providerRequestId).toBe("req_und");
    expect(result.outputText).toContain('"color"');
    expect(JSON.parse(String(calls[0]!.init!.body)).model).toBe("muse-spark-1.3");
  });

  it("parses generation image_generation_call result", async () => {
    const { calls, fetchFn } = fakeFetch({
      id: "req_gen",
      output: [{ type: "image_generation_call", result: "aGVsbG8=" }],
    });
    const meta = createMetaAdapter(key, fetchFn);
    const result = (await meta.generateConcept({
      prompt: "a dress",
      imageDataUrl: "data:image/png;base64,AAA",
    })) as { providerRequestId: string | null; modelId: string; imageBase64: string };
    expect(result).toEqual({
      providerRequestId: "req_gen",
      modelId: "muse-image-1.0",
      imageBase64: "aGVsbG8=",
    });
    expect(JSON.parse(String(calls[0]!.init!.body)).model).toBe("muse-image-1.0");
  });

  it("maps HTTP 500 to PROVIDER_UNAVAILABLE without leaking the body", async () => {
    const { fetchFn } = fakeFetch("upstream secret failure detail", 500);
    const meta = createMetaAdapter(key, fetchFn);
    await expect(
      meta.understandFabric({ imageDataUrl: "data:image/png;base64,AAA", prompt: "x" }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    await expect(
      meta.understandFabric({ imageDataUrl: "data:image/png;base64,AAA", prompt: "x" }),
    ).rejects.not.toThrow(/secret/);
  });

  it("fails closed without an API key and without calling fetch", async () => {
    const { calls, fetchFn } = fakeFetch({ id: "x", output_text: "ok" });
    const meta = createMetaAdapter(async () => null, fetchFn);
    await expect(
      meta.segmentFabric({ imageDataUrl: "data:image/png;base64,AAA", prompt: "fabric" }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(calls).toHaveLength(0);
  });

  it("rejects missing input and network errors as PROVIDER_UNAVAILABLE", async () => {
    const meta = createMetaAdapter(key, (async () => {
      throw new Error("network down");
    }) as typeof fetch);
    await expect(meta.segmentFabric({ prompt: "fabric" })).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
    await expect(
      meta.understandFabric({ imageDataUrl: "data:image/png;base64,AAA", prompt: "x" }),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    await expect(meta.assembleBrief({})).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });
});
