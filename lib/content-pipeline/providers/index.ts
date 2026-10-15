import type { AiProvider } from "./types";
import { createAnthropicProvider } from "./anthropic";
import { createOpenAiProvider } from "./openai";
import { createGeminiProvider } from "./gemini";

export type { AiProvider };
export { AiProviderError } from "./types";

const PROVIDER_FACTORIES: Record<string, () => AiProvider> = {
  anthropic: createAnthropicProvider,
  openai: createOpenAiProvider,
  gemini: createGeminiProvider,
};

/**
 * The single switch that decides which AI provider/model every pipeline
 * stage actually calls. Set AI_PROVIDER ("anthropic" | "openai" | "gemini")
 * in the environment and every stage picks it up on its next call, with
 * zero changes to lib/content-pipeline/stages.ts or prompts.ts — those
 * only ever ask for "the active provider" through callAiForJson() (see
 * ../ai.ts), never a named one. Swapping providers, or just swapping
 * models via ANTHROPIC_MODEL/OPENAI_MODEL/GEMINI_MODEL, is a config
 * change, not a code change.
 *
 * Adding a new provider later: write providers/<name>.ts exporting a
 * createXProvider() that returns an AiProvider (one method, `complete`),
 * register it in PROVIDER_FACTORIES above, and it's available the same way.
 */
export function getActiveProvider(): AiProvider {
  const name = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  const factory = PROVIDER_FACTORIES[name];
  if (!factory) {
    throw new Error(`Unknown AI_PROVIDER "${name}" — expected one of: ${Object.keys(PROVIDER_FACTORIES).join(", ")}`);
  }
  return factory();
}
