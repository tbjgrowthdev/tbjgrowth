import type { AiImageProvider, AiProvider } from "./types";
import { createAnthropicProvider } from "./anthropic";
import { createOpenAiProvider } from "./openai";
import { createGeminiProvider } from "./gemini";
import { COMPATIBLE_APIS, createOpenAiCompatibleProvider } from "./openai-compatible";
import { createOpenAiImageProvider } from "./openai-image";
import { createGeminiImageProvider } from "./gemini-image";
import { resolveAiConfig } from "./config";
import { getAiApiKey } from "./keys";

export type { AiProvider, AiImageProvider };
export { AiProviderError } from "./types";

// Factories are pure: they take an already-resolved key (or null) and a
// model override. Key resolution (admin-entered key → env var) happens once,
// in buildTextProvider/buildImageProvider below, via ./keys.ts.
type TextFactory = (apiKey: string | null, model?: string) => AiProvider;
type ImageFactory = (apiKey: string | null, model?: string) => AiImageProvider;

const PROVIDER_FACTORIES: Record<string, TextFactory> = {
  anthropic: createAnthropicProvider,
  openai: createOpenAiProvider,
  gemini: createGeminiProvider,
  xai: (key, model) => createOpenAiCompatibleProvider(COMPATIBLE_APIS.xai, key, model),
  openrouter: (key, model) => createOpenAiCompatibleProvider(COMPATIBLE_APIS.openrouter, key, model),
  cerebras: (key, model) => createOpenAiCompatibleProvider(COMPATIBLE_APIS.cerebras, key, model),
};

// Separate registry from the text providers above — Anthropic has no
// image-generation API, so "the active text provider" can never double as
// "the active image provider."
const IMAGE_PROVIDER_FACTORIES: Record<string, ImageFactory> = {
  openai: createOpenAiImageProvider,
  gemini: createGeminiImageProvider,
};

function textFactory(name: string): TextFactory {
  const factory = PROVIDER_FACTORIES[name];
  if (!factory) throw new Error(`Unknown AI provider "${name}" — expected one of: ${Object.keys(PROVIDER_FACTORIES).join(", ")}`);
  return factory;
}

function imageFactory(name: string): ImageFactory {
  const factory = IMAGE_PROVIDER_FACTORIES[name];
  if (!factory) throw new Error(`Unknown AI image provider "${name}" — expected one of: ${Object.keys(IMAGE_PROVIDER_FACTORIES).join(", ")}`);
  return factory;
}

/** The model a text provider would use for this override (or its *_MODEL env var / built-in default) — no key lookup, no network. */
export function resolveTextModel(name: string, model?: string | null): string {
  return textFactory(name)(null, model ?? undefined).model;
}

export function resolveImageModel(name: string, model?: string | null): string {
  return imageFactory(name)(null, model ?? undefined).model;
}

/** A specific text provider/model with its resolved key, regardless of what's active — for Settings' "Test connection". */
export async function buildTextProvider(name: string, model?: string | null): Promise<AiProvider> {
  const factory = textFactory(name);
  return factory(await getAiApiKey(name), model ?? undefined);
}

export async function buildImageProvider(name: string, model?: string | null): Promise<AiImageProvider> {
  const factory = imageFactory(name);
  return factory(await getAiApiKey(name), model ?? undefined);
}

/**
 * The single switch that decides which AI provider/model every pipeline
 * stage actually calls. Selection comes from Settings → AI Provider when a
 * Super Admin has set one, otherwise from the AI_PROVIDER / *_MODEL env
 * vars (see ./config.ts); the key comes from Settings → AI Provider when an
 * admin stored one, otherwise from the *_API_KEY env var (see ./keys.ts).
 * Stages never name a provider themselves — they only ever ask for "the
 * active provider" through callAiForJson() (../ai.ts) — so switching is a
 * settings change, not a code change.
 *
 * Adding a new provider later: for an OpenAI-compatible API, add an entry to
 * COMPATIBLE_APIS (./openai-compatible.ts); otherwise write
 * providers/<name>.ts exporting a createXProvider(apiKey, model?) that
 * returns an AiProvider. Then register it in PROVIDER_FACTORIES above and in
 * ./catalog.ts (TEXT_PROVIDERS, PROVIDER_LABEL, PROVIDER_KEY_ENV,
 * AI_KEY_INTEGRATION — the last needs an IntegrationProvider enum value and
 * a migration).
 */
export async function getActiveProvider(): Promise<AiProvider> {
  const { text } = await resolveAiConfig();
  return buildTextProvider(text.provider, text.model);
}

export async function getActiveImageProvider(): Promise<AiImageProvider> {
  const { image } = await resolveAiConfig();
  return buildImageProvider(image.provider, image.model);
}
