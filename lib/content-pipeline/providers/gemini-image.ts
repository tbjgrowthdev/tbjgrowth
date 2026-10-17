import type { AiImageProvider } from "./types";
import { AiProviderError } from "./types";

// Gemini's image-capable chat model, via the same generateContent endpoint
// the text Gemini provider uses — an image-capable model returns inline
// image bytes as one of the response's parts instead of (or alongside)
// text, rather than needing a separate "images" API the way OpenAI does.
const DEFAULT_MODEL = "gemini-2.5-flash-image";

export function createGeminiImageProvider(): AiImageProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;

  return {
    name: "gemini",
    model,
    async generateImage(prompt) {
      if (!apiKey) throw new AiProviderError("GEMINI_API_KEY is not configured");

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new AiProviderError(`Gemini image API request failed (${res.status}): ${errorText}`);
      }

      const data: { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] } = await res.json();
      const inline = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
      if (!inline?.data) {
        throw new AiProviderError("Gemini image API response had no inline image data");
      }

      const binary = Buffer.from(inline.data, "base64");
      return { data: binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength), mimeType: inline.mimeType || "image/png" };
    },
  };
}
