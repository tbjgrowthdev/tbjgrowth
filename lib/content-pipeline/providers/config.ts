import { prisma } from "@/lib/prisma";

import { isImageProvider, isTextProvider, isValidModelName } from "./catalog";
import { resolveAiApiKey } from "./keys";

export {
  TEXT_PROVIDERS,
  IMAGE_PROVIDERS,
  PROVIDER_LABEL,
  PROVIDER_KEY_ENV,
  MODEL_NAME_PATTERN,
  OPENROUTER_MODEL_PATTERN,
  isTextProvider,
  isImageProvider,
  isValidModelName,
  maskKey,
} from "./catalog";
export type { TextProviderName, ImageProviderName } from "./catalog";

/** Whether a key is available for this provider — an admin-entered one (Integration Hub) or its env var. */
export async function hasProviderKey(name: string): Promise<boolean> {
  return (await resolveAiApiKey(name)).source !== "none";
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

function validModel(provider: string, model: string | null | undefined): string | null {
  return model && isValidModelName(provider, model) ? model : null;
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
    ? { provider: row!.textProvider!, model: validModel(row!.textProvider!, row!.textModel), source: "admin" }
    : { provider: (process.env.AI_PROVIDER || "anthropic").toLowerCase(), model: null, source: "env" };

  const image: ResolvedSelection = isImageProvider(row?.imageProvider)
    ? { provider: row!.imageProvider!, model: validModel(row!.imageProvider!, row!.imageModel), source: "admin" }
    : { provider: (process.env.AI_IMAGE_PROVIDER || "openai").toLowerCase(), model: null, source: "env" };

  return { text, image };
}
