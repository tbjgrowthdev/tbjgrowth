import type { AiImageProvider } from "./types";
import { AiProviderError } from "./types";
import { providerFetch, imageRequestTimeoutMs } from "./http";
import { redactSecret } from "./catalog";

// Gemini's image-capable chat model, via the same generateContent endpoint
// the text Gemini provider uses — an image-capable model returns inline
// image bytes as one of the response's parts instead of (or alongside)
// text, rather than needing a separate "images" API the way OpenAI does.
const DEFAULT_MODEL = "gemini-2.5-flash-image";

export function createGeminiImageProvider(apiKey: string | null, modelOverride?: string): AiImageProvider {
  const model = modelOverride || process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;

  return {
    name: "gemini",
    model,
    async generateImage(prompt) {
      if (!apiKey) throw new AiProviderError("No Gemini API key is configured (Settings → AI Provider, or GEMINI_API_KEY)");

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const call = await providerFetch("Gemini image API", url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
      }, imageRequestTimeoutMs());
      const res = call.res;

      if (!res.ok) {
        const errorText = await call.text();
        throw new AiProviderError(`Gemini image API request failed (${res.status}): ${redactSecret(errorText, apiKey)}`);
      }

      const data: { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] } = await call.json();
      const inline = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
      if (!inline?.data) {
        throw new AiProviderError("Gemini image API response had no inline image data");
      }

      const binary = Buffer.from(inline.data, "base64");
      return { data: binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength), mimeType: inline.mimeType || "image/png" };
    },
  };
}
