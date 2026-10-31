// Static facts about every AI provider: names, labels, env var names, the
// Integration Hub enum each one's stored key lives under, and model-name
// validation. Deliberately has NO imports (not even Prisma types), so it
// can be shared by server code, the Integration Hub registry and the unit
// tests without pulling in a database client.

export const TEXT_PROVIDERS = ["anthropic", "openai", "gemini", "xai", "openrouter", "cerebras"] as const;
export const IMAGE_PROVIDERS = ["openai", "gemini"] as const;
export type TextProviderName = (typeof TEXT_PROVIDERS)[number];
export type ImageProviderName = (typeof IMAGE_PROVIDERS)[number];

/** Every provider that can hold an API key. Image providers are a subset of text providers, so this is TEXT_PROVIDERS. */
export const AI_KEY_PROVIDERS = TEXT_PROVIDERS;
export type AiKeyProviderName = TextProviderName;

export const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
  xai: "xAI (Grok)",
  openrouter: "OpenRouter",
  cerebras: "Cerebras",
};

export const PROVIDER_KEY_ENV: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  xai: "XAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
};

/**
 * The IntegrationProvider enum value each provider's admin-entered key is
 * stored under (Integration.encryptedCredentials = encrypted { apiKey }).
 * Kept as plain strings so this file stays import-free; the values must
 * match prisma/schema.prisma's IntegrationProvider enum.
 */
export const AI_KEY_INTEGRATION = {
  anthropic: "ANTHROPIC",
  openai: "OPENAI",
  gemini: "GEMINI",
  xai: "XAI",
  openrouter: "OPENROUTER",
  cerebras: "CEREBRAS",
} as const satisfies Record<AiKeyProviderName, string>;

// Gemini interpolates the model name straight into its request URL path,
// so this is a security boundary, not just tidiness: no slashes, query
// characters, or whitespace can ever reach a provider URL from admin input.
export const MODEL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

// OpenRouter model ids are "vendor/model" (optionally with a ":variant"
// suffix, e.g. "meta-llama/llama-3.3-70b-instruct:free"). Exactly one "/"
// between two strict segments — the id only ever goes in a JSON body, never
// a URL, but there's no reason to accept anything looser.
export const OPENROUTER_MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,59}\/[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

export function isTextProvider(name: string | null | undefined): name is TextProviderName {
  return !!name && (TEXT_PROVIDERS as readonly string[]).includes(name);
}

export function isImageProvider(name: string | null | undefined): name is ImageProviderName {
  return !!name && (IMAGE_PROVIDERS as readonly string[]).includes(name);
}

export function isAiKeyProvider(name: string | null | undefined): name is AiKeyProviderName {
  return isTextProvider(name);
}

/** Whether `model` is a safe model name for `provider`. "/" is only ever allowed for OpenRouter. */
export function isValidModelName(provider: string | null | undefined, model: string | null | undefined): boolean {
  if (!model) return false;
  if (MODEL_NAME_PATTERN.test(model)) return true;
  return provider === "openrouter" && OPENROUTER_MODEL_PATTERN.test(model);
}

/**
 * The only form of an API key that ever leaves the server: its last 4
 * characters behind a fixed-width mask. Keys of 8 characters or fewer show
 * nothing at all — 4 characters of a very short secret is too much of it.
 */
export function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••";
  return `••••${trimmed.slice(-4)}`;
}

/** Last 4 characters, stored as non-secret metadata so the UI can show a masked key without decrypting. Empty for very short keys (see maskKey). */
export function keyLast4(key: string): string {
  const trimmed = key.trim();
  return trimmed.length <= 8 ? "" : trimmed.slice(-4);
}

/** Removes every occurrence of `secret` from `text` — applied to provider error bodies, which some APIs use to echo the key they rejected. */
export function redactSecret(text: string, secret: string | null | undefined): string {
  if (!secret || secret.length < 4) return text;
  return text.split(secret).join("[redacted]");
}
