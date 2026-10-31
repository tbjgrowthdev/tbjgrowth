import type { AiProvider } from "./types";
import { AiProviderError } from "./types";
import { redactSecret } from "./catalog";

const DEFAULT_MODEL = "gemini-2.5-flash";

export function createGeminiProvider(apiKey: string | null, modelOverride?: string): AiProvider {
  const model = modelOverride || process.env.GEMINI_MODEL || DEFAULT_MODEL;

  return {
    name: "gemini",
    model,
    async complete(system, userPrompt, maxTokens) {
      if (!apiKey) throw new AiProviderError("No Gemini API key is configured (Settings → AI Provider, or GEMINI_API_KEY)");

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new AiProviderError(`Gemini API request failed (${res.status}): ${redactSecret(errorText, apiKey)}`);
      }

      const data: {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      } = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
      if (!text) {
        throw new AiProviderError("Gemini API response had no text content");
      }
      return {
        text,
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        usageUnknown: data.usageMetadata?.promptTokenCount == null || data.usageMetadata?.candidatesTokenCount == null,
      };
    },
  };
}
