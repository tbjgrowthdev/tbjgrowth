import type { AiProvider } from "./types";
import { AiProviderError } from "./types";
import { PROVIDER_KEY_ENV, PROVIDER_LABEL, redactSecret } from "./catalog";

/**
 * One provider implementation for every API that speaks the OpenAI Chat
 * Completions wire format (POST {baseUrl}/chat/completions, Bearer auth,
 * choices[0].message.content, usage.prompt_tokens/completion_tokens).
 * Adding another such vendor is a new entry in COMPATIBLE_APIS, not a new file.
 */
export interface OpenAiCompatibleApi {
  /** Provider id as used everywhere else (TEXT_PROVIDERS). */
  name: string;
  baseUrl: string;
  /** Env var holding the default model, used when no admin model is saved. */
  modelEnv: string;
  defaultModel: string;
  /**
   * The output-cap parameter each API documents as primary (checked against
   * each vendor's API reference, 2026-10):
   * - xAI: max_completion_tokens; max_tokens is marked deprecated.
   * - Cerebras: max_completion_tokens; max_tokens is only an alias.
   * - OpenRouter: max_tokens; max_completion_tokens is accepted as an alias.
   */
  maxTokensParam: "max_tokens" | "max_completion_tokens";
}

export const COMPATIBLE_APIS: Record<string, OpenAiCompatibleApi> = {
  xai: { name: "xai", baseUrl: "https://api.x.ai/v1", modelEnv: "XAI_MODEL", defaultModel: "grok-4.3", maxTokensParam: "max_completion_tokens" },
  openrouter: { name: "openrouter", baseUrl: "https://openrouter.ai/api/v1", modelEnv: "OPENROUTER_MODEL", defaultModel: "openai/gpt-5", maxTokensParam: "max_tokens" },
  cerebras: { name: "cerebras", baseUrl: "https://api.cerebras.ai/v1", modelEnv: "CEREBRAS_MODEL", defaultModel: "gpt-oss-120b", maxTokensParam: "max_completion_tokens" },
};

type ChatCompletionResponse = {
  choices?: { message?: { content?: unknown } }[];
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } | null;
};

function tokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Reads usage defensively: anything missing or non-numeric becomes 0 and flags the usage as unknown. */
export function parseCompatibleUsage(usage: ChatCompletionResponse["usage"]): { inputTokens: number; outputTokens: number; usageUnknown: boolean } {
  const input = tokenCount(usage?.prompt_tokens);
  const output = tokenCount(usage?.completion_tokens);
  return { inputTokens: input ?? 0, outputTokens: output ?? 0, usageUnknown: input === null || output === null };
}

/** The request body for one completion — split out so the per-API max-tokens parameter is unit-testable. */
export function buildCompatibleRequestBody(api: OpenAiCompatibleApi, model: string, system: string, userPrompt: string, maxTokens: number) {
  return {
    model,
    [api.maxTokensParam]: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
  };
}

export function createOpenAiCompatibleProvider(api: OpenAiCompatibleApi, apiKey: string | null, modelOverride?: string): AiProvider {
  // Admin-entered model wins, then the *_MODEL env var, then the built-in default.
  const model = modelOverride || process.env[api.modelEnv] || api.defaultModel;
  const label = PROVIDER_LABEL[api.name] ?? api.name;

  return {
    name: api.name,
    model,
    async complete(system, userPrompt, maxTokens) {
      if (!apiKey) throw new AiProviderError(`No ${label} API key is configured (Settings → AI Provider, or ${PROVIDER_KEY_ENV[api.name]})`);

      const res = await fetch(`${api.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildCompatibleRequestBody(api, model, system, userPrompt, maxTokens)),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new AiProviderError(`${label} API request failed (${res.status}): ${redactSecret(errorText, apiKey).slice(0, 2000)}`);
      }

      const data: ChatCompletionResponse = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== "string") {
        throw new AiProviderError(`${label} API response had no text content`);
      }
      return { text, ...parseCompatibleUsage(data.usage) };
    },
  };
}
