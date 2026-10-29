import { prisma } from "@/lib/prisma";

export const TEXT_PROVIDERS = ["anthropic", "openai", "gemini"] as const;
export const IMAGE_PROVIDERS = ["openai", "gemini"] as const;
export type TextProviderName = (typeof TEXT_PROVIDERS)[number];
export type ImageProviderName = (typeof IMAGE_PROVIDERS)[number];

export const PROVIDER_LABEL: Record<string, string> = { anthropic: "Anthropic", openai: "OpenAI", gemini: "Gemini" };
export const PROVIDER_KEY_ENV: Record<string, string> = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY" };

// Gemini interpolates the model name straight into its request URL path,
// so this is a security boundary, not just tidiness: no slashes, query
// characters, or whitespace can ever reach a provider URL from admin input.
export const MODEL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

export function isTextProvider(name: string | null | undefined): name is TextProviderName {
  return !!name && (TEXT_PROVIDERS as readonly string[]).includes(name);
}

export function isImageProvider(name: string | null | undefined): name is ImageProviderName {
  return !!name && (IMAGE_PROVIDERS as readonly string[]).includes(name);
}

export function hasProviderKey(name: string): boolean {
  const envName = PROVIDER_KEY_ENV[name];
  return !!envName && !!process.env[envName];
}

export interface ResolvedSelection {
  provider: string;
  /** Explicit model override, or null to let the provider use its env var / built-in default. */
  model: string | null;
  source: "admin" | "env";
}

export interface ResolvedAiConfig {
  text: ResolvedSelection;
  image: ResolvedSelection;
}

function validModel(model: string | null | undefined): string | null {
  return model && MODEL_NAME_PATTERN.test(model) ? model : null;
}

/**
 * The admin-panel selection (AiSettings row) when one is set, otherwise the
 * AI_PROVIDER / AI_IMAGE_PROVIDER env vars — read fresh on every call, so a
 * switch in Settings applies to the very next AI call with no redeploy.
 *
 * Any failure reading the row (including the table not existing yet
 * because a deploy ran ahead of its migration) falls back to the env vars
 * rather than failing the AI call: the env vars were the only mechanism
 * before this table existed, so they're always a valid configuration.
 * Stored values are re-validated here too, so a bad row can't select an
 * unknown provider or smuggle an unsafe model name into a request URL.
 */
export async function resolveAiConfig(): Promise<ResolvedAiConfig> {
  let row: { textProvider: string | null; textModel: string | null; imageProvider: string | null; imageModel: string | null } | null = null;
  try {
    row = await prisma.aiSettings.findUnique({
      where: { id: "global" },
      select: { textProvider: true, textModel: true, imageProvider: true, imageModel: true },
    });
  } catch (error) {
    console.error("Failed to read AiSettings — falling back to AI_PROVIDER/AI_IMAGE_PROVIDER env vars:", error);
  }

  const text: ResolvedSelection = isTextProvider(row?.textProvider)
    ? { provider: row!.textProvider!, model: validModel(row!.textModel), source: "admin" }
    : { provider: (process.env.AI_PROVIDER || "anthropic").toLowerCase(), model: null, source: "env" };

  const image: ResolvedSelection = isImageProvider(row?.imageProvider)
    ? { provider: row!.imageProvider!, model: validModel(row!.imageModel), source: "admin" }
    : { provider: (process.env.AI_IMAGE_PROVIDER || "openai").toLowerCase(), model: null, source: "env" };

  return { text, image };
}
