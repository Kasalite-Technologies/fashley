import { createFileRoute } from "@tanstack/react-router";
import { editImage, imageSettings } from "@/lib/image-gateway.server";
import { buildDesignPrompt } from "@/lib/design-prompt.server";
import { z } from "zod";
import { createParser } from "eventsource-parser";

export const Route = createFileRoute("/api/edit-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
        if (!token) return new Response("Please sign in to generate designs", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !data.user) return new Response("Please sign in to generate designs", { status: 401 });

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Design generation isn’t available yet.", { status: 500 });
        const form = await request.formData();
        let rawPreferences: unknown;
        try { rawPreferences = JSON.parse(String(form.get("preferences") ?? "null")); }
        catch { return new Response("Please check your design choices.", { status: 400 }); }
        const preferences = z.object({
          kind: z.enum(["outfits", "shoes", "bags"]),
          category: z.string().min(1).max(50), occasion: z.string().max(50),
          style: z.string().max(50), hardware: z.enum(["Gold", "Silver", "Black", "None"]),
          notes: z.string().max(200), variant: z.number().int().min(0).max(3),
        }).safeParse(rawPreferences);
        if (!preferences.success) return new Response("Please check your design choices.", { status: 400 });
        const generationId = z.string().uuid().safeParse(form.get("generation_id"));
        if (!generationId.success) return new Response("We couldn’t read this design request. Please try again.", { status: 400 });
        const image = form.get("image");
        if (!(image instanceof File) || !image.size) return new Response("Please upload a material photo", { status: 400 });
        const reserved = await supabaseAdmin.rpc("reserve_coin_generation", { p_user: data.user.id, p_request: generationId.data });
        if (reserved.error) return new Response(reserved.error.message, { status: 409 });
        form.delete("generation_id");
        form.delete("preferences");
        form.set("prompt", buildDesignPrompt(preferences.data));
        const finish = async (success: boolean) => {
          const result = await supabaseAdmin.rpc("finish_coin_generation", { p_request: generationId.data, p_success: success });
          if (result.error) throw new Error("We couldn’t update the coin record for this design.");
        };
        let upstream: Response;
        try { upstream = await editImage({ ...imageSettings, apiKey }, form); }
        catch { await finish(false); return new Response("We couldn’t start this design. Your coins were returned.", { status: 502 }); }
        if (!upstream.ok || !upstream.body) { await finish(false); return new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" } }); }
        if (!upstream.headers.get("Content-Type")?.includes("text/event-stream")) {
          const body = await upstream.text();
          let success = false;
          try { success = Boolean(JSON.parse(body)?.data?.[0]?.b64_json); } catch { /* malformed response is not success */ }
          await finish(success);
          return new Response(body, { status: upstream.status, headers: { "Content-Type": "application/json" } });
        }
        let completed = false;
        let failed = false;
        const parser = createParser({ onEvent(event) {
          try {
            const payload = JSON.parse(event.data);
            const type = event.event || payload.type;
            if (type === "error" || payload.type === "error") failed = true;
            if ((type === "image_generation.completed" || type === "image_edit.completed") && payload.b64_json) completed = true;
          } catch { /* ignore non-image events */ }
        } });
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        // Forward original bytes unchanged, observing terminal events only for accounting.
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                parser.feed(decoder.decode(chunk.value, { stream: true }));
                try { controller.enqueue(chunk.value); } catch { /* client left; still settle upstream */ }
              }
              parser.feed(decoder.decode());
              await finish(completed && !failed);
              try { controller.close(); } catch { /* client left */ }
            } catch {
              await finish(false);
              try { controller.error(new Error("This design stopped before it finished. Your coins were returned.")); } catch { /* already closed */ }
            }
          },
        });
        return new Response(body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
