import type { AiProvider } from "./types";
import { AiProviderError } from "./types";
import { redactSecret } from "./catalog";

// Raw fetch against the Anthropic Messages API — same house convention as
// every other external integration in this project (Resend, Cloudinary,
// DataForSEO all call fetch() directly rather than pulling in a vendor
// SDK), and it keeps this edge-safe for the Cloudflare Worker runtime.
const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5-5";

/** `apiKey` is resolved by the caller (./keys.ts: admin-entered key, else ANTHROPIC_API_KEY). */
export function createAnthropicProvider(apiKey: string | null, modelOverride?: string): AiProvider {
  const model = modelOverride || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  return {
    name: "anthropic",
    model,
    async complete(system, userPrompt, maxTokens) {
      if (!apiKey) throw new AiProviderError("No Anthropic API key is configured (Settings → AI Provider, or ANTHROPIC_API_KEY)");

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new AiProviderError(`Anthropic API request failed (${res.status}): ${redactSecret(errorText, apiKey)}`);
      }

      const data: { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } } = await res.json();
      const text = data?.content?.find((block) => block.type === "text")?.text;
      if (typeof text !== "string") {
        throw new AiProviderError("Anthropic API response had no text content");
      }
      return {
        text,
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        usageUnknown: data.usage?.input_tokens == null || data.usage?.output_tokens == null,
      };
    },
  };
}
