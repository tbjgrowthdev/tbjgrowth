import type { AiProvider } from "./types";
import { AiProviderError } from "./types";
import { providerFetch, textRequestTimeoutMs } from "./http";
import { redactSecret } from "./catalog";

const API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-5";

/** `apiKey` is resolved by the caller (./keys.ts: admin-entered key, else OPENAI_API_KEY). */
export function createOpenAiProvider(apiKey: string | null, modelOverride?: string): AiProvider {
  const model = modelOverride || process.env.OPENAI_MODEL || DEFAULT_MODEL;

  return {
    name: "openai",
    model,
    async complete(system, userPrompt, maxTokens) {
      if (!apiKey) throw new AiProviderError("No OpenAI API key is configured (Settings → AI Provider, or OPENAI_API_KEY)");

      const call = await providerFetch("OpenAI API", API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          // Current-generation OpenAI models use max_completion_tokens, not
          // the older max_tokens — if OPENAI_MODEL is overridden to an
          // older model that doesn't recognize it, drop this field there.
          max_completion_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
        }),
      }, textRequestTimeoutMs());
      const res = call.res;

      if (!res.ok) {
        const errorText = await call.text();
        throw new AiProviderError(`OpenAI API request failed (${res.status}): ${redactSecret(errorText, apiKey)}`);
      }

      const data: { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } } = await call.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== "string") {
        throw new AiProviderError("OpenAI API response had no text content");
      }
      return {
        text,
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        usageUnknown: data.usage?.prompt_tokens == null || data.usage?.completion_tokens == null,
      };
    },
  };
}
