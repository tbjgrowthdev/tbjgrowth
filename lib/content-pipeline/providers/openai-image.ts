import type { AiImageProvider } from "./types";
import { AiProviderError } from "./types";

const API_URL = "https://api.openai.com/v1/images/generations";
const DEFAULT_MODEL = "gpt-image-1";

export function createOpenAiImageProvider(): AiImageProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL;

  return {
    name: "openai",
    model,
    async generateImage(prompt) {
      if (!apiKey) throw new AiProviderError("OPENAI_API_KEY is not configured");

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, size: "1024x1024", n: 1 }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new AiProviderError(`OpenAI Images API request failed (${res.status}): ${errorText}`);
      }

      const data: { data?: { b64_json?: string }[] } = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (!b64) {
        throw new AiProviderError("OpenAI Images API response had no image data");
      }

      const binary = Buffer.from(b64, "base64");
      return { data: binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength), mimeType: "image/png" };
    },
  };
}
