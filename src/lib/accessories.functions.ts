import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccessoryItem = { name: string; color: string; why: string };
export type Accessories = { shoes: AccessoryItem[]; bags: AccessoryItem[]; tip: string };

const itemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "color", "why"],
  properties: { name: { type: "string" }, color: { type: "string" }, why: { type: "string" } },
};

export const suggestAccessories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      category: z.string().max(80),
      occasion: z.string().max(80),
      style: z.string().max(80),
      fabricNotes: z.string().max(500),
      imageDataUrl: z.string().max(12_000_000).optional(),
    }),
  )
  .handler(async ({ data }): Promise<Accessories> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Accessory suggestions aren’t available yet.");
    const content: unknown[] = [
      {
        type: "input_text",
        text: `You are a fashion stylist. Suggest 3 complementary shoes and 3 handbags for this outfit concept.
Category: ${data.category}. Occasion: ${data.occasion}. Style: ${data.style}. Fabric notes: ${data.fabricNotes || "see image"}.
Keep names short and specific (e.g. "Block-heel strappy sandal"). Colors should harmonise with the fabric palette. "why" is one sentence. "tip" is one styling sentence.`,
      },
    ];
    if (data.imageDataUrl) content.push({ type: "input_image", image_url: data.imageDataUrl });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Lovable-API-Key": apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "accessories",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["shoes", "bags", "tip"],
              properties: {
                shoes: { type: "array", items: itemSchema },
                bags: { type: "array", items: itemSchema },
                tip: { type: "string" },
              },
            },
          },
        },
      }),
    });
    if (!res.ok || !res.body) {
      const msg = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Too many requests right now. Please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits have run out. Please add credits to continue.");
      throw new Error(`We couldn’t find matching accessories (${res.status}) ${msg.slice(0, 200)}`);
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    let text = "";
    let failure: string | undefined;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += value;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta") text += evt.delta ?? "";
          if (evt.type === "error" || evt.type === "response.failed")
            failure = evt.error?.message ?? evt.response?.error?.message ?? "AI request failed";
        } catch {
          /* ignore partial */
        }
      }
    }
    if (failure) throw new Error(failure);
    if (!text) throw new Error("We couldn’t find accessory suggestions. Please try again.");
    return JSON.parse(text) as Accessories;
  });
