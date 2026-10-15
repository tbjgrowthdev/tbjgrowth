import type { AiProvider } from "./types";
import { AiProviderError } from "./types";

const DEFAULT_MODEL = "gemini-2.5-flash";

export function createGeminiProvider(): AiProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  return {
    name: "gemini",
    model,
    async complete(system, userPrompt, maxTokens) {
      if (!apiKey) throw new AiProviderError("GEMINI_API_KEY is not configured");

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new AiProviderError(`Gemini API request failed (${res.status}): ${errorText}`);
      }

      const data: {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      } = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
      if (!text) {
        throw new AiProviderError("Gemini API response had no text content");
      }
      return { text, inputTokens: data.usageMetadata?.promptTokenCount ?? 0, outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0 };
    },
  };
}
