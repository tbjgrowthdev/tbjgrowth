import type { AiImageProvider, AiProvider } from "./types";
import { createAnthropicProvider } from "./anthropic";
import { createOpenAiProvider } from "./openai";
import { createGeminiProvider } from "./gemini";
import { createOpenAiImageProvider } from "./openai-image";
import { createGeminiImageProvider } from "./gemini-image";
import { resolveAiConfig } from "./config";

export type { AiProvider, AiImageProvider };
export { AiProviderError } from "./types";

const PROVIDER_FACTORIES: Record<string, (model?: string) => AiProvider> = {
  anthropic: createAnthropicProvider,
  openai: createOpenAiProvider,
  gemini: createGeminiProvider,
};

// Separate registry from the text providers above — Anthropic has no
// image-generation API, so "the active text provider" can never double as
// "the active image provider."
const IMAGE_PROVIDER_FACTORIES: Record<string, (model?: string) => AiImageProvider> = {
  openai: createOpenAiImageProvider,
  gemini: createGeminiImageProvider,
};

/** A specific text provider/model, regardless of what's active — for Settings' "Test connection" before saving. */
export function buildTextProvider(name: string, model?: string | null): AiProvider {
  const factory = PROVIDER_FACTORIES[name];
  if (!factory) throw new Error(`Unknown AI provider "${name}" — expected one of: ${Object.keys(PROVIDER_FACTORIES).join(", ")}`);
  return factory(model ?? undefined);
}

export function buildImageProvider(name: string, model?: string | null): AiImageProvider {
  const factory = IMAGE_PROVIDER_FACTORIES[name];
  if (!factory) throw new Error(`Unknown AI image provider "${name}" — expected one of: ${Object.keys(IMAGE_PROVIDER_FACTORIES).join(", ")}`);
  return factory(model ?? undefined);
}

/**
 * The single switch that decides which AI provider/model every pipeline
 * stage actually calls. Selection comes from Settings → AI Provider when a
 * Super Admin has set one, otherwise from the AI_PROVIDER / *_MODEL env
 * vars (see ./config.ts). Stages never name a provider themselves — they
 * only ever ask for "the active provider" through callAiForJson() (../ai.ts)
 * — so switching is a settings change, not a code change.
 *
 * Adding a new provider later: write providers/<name>.ts exporting a
 * createXProvider(model?) that returns an AiProvider (one method,
 * `complete`), register it in PROVIDER_FACTORIES above and TEXT_PROVIDERS
 * in ./config.ts, and it's selectable the same way.
 */
export async function getActiveProvider(): Promise<AiProvider> {
  const { text } = await resolveAiConfig();
  return buildTextProvider(text.provider, text.model);
}

export async function getActiveImageProvider(): Promise<AiImageProvider> {
  const { image } = await resolveAiConfig();
  return buildImageProvider(image.provider, image.model);
}
