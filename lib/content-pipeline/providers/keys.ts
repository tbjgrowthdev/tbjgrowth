import { prisma } from "@/lib/prisma";
import { decryptJson } from "@/lib/integrations/crypto";
import type { IntegrationProvider } from "@/lib/generated/prisma/client";
import { AI_KEY_INTEGRATION, PROVIDER_KEY_ENV, isAiKeyProvider, type AiKeyProviderName } from "./catalog";

export type AiKeySource = "admin" | "env" | "none";

export interface ResolvedAiKey {
  key: string | null;
  source: AiKeySource;
}

/** What resolveKeyWith() needs from the outside world — injected so the resolution order is unit-testable without a database. */
export interface KeyResolutionDeps {
  /** The stored ciphertext for this provider, or null when there's no row. May throw (table/enum missing, DB down). */
  readEncrypted(provider: AiKeyProviderName): Promise<string | null>;
  /** May throw (wrong INTEGRATION_ENCRYPTION_KEY, tampered ciphertext). */
  decrypt(packed: string): { apiKey?: unknown };
  env: Record<string, string | undefined>;
  log(message: string): void;
}

function envKey(provider: string, env: Record<string, string | undefined>): string | null {
  const name = PROVIDER_KEY_ENV[provider];
  const value = name ? env[name]?.trim() : undefined;
  return value ? value : null;
}

/**
 * Resolution order: an admin-entered key (Integration Hub row, decrypted)
 * → the provider's *_API_KEY env var → none. Any failure on the database
 * side is logged (provider name and error message only — never the key or
 * ciphertext) and falls through to the env var, so a missing migration, a
 * rotated INTEGRATION_ENCRYPTION_KEY or a DB blip can never break an AI call
 * that the env var alone could have served.
 */
export async function resolveKeyWith(provider: string, deps: KeyResolutionDeps): Promise<ResolvedAiKey> {
  if (!isAiKeyProvider(provider)) return { key: null, source: "none" };

  try {
    const packed = await deps.readEncrypted(provider);
    if (packed) {
      const { apiKey } = deps.decrypt(packed);
      if (typeof apiKey === "string" && apiKey.trim()) return { key: apiKey.trim(), source: "admin" };
      deps.log(`Stored ${provider} API key is empty or malformed — falling back to ${PROVIDER_KEY_ENV[provider]}`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    deps.log(`Couldn't read the stored ${provider} API key (${reason}) — falling back to ${PROVIDER_KEY_ENV[provider]}`);
  }

  const fromEnv = envKey(provider, deps.env);
  return fromEnv ? { key: fromEnv, source: "env" } : { key: null, source: "none" };
}

const liveDeps: KeyResolutionDeps = {
  async readEncrypted(provider) {
    const row = await prisma.integration.findUnique({
      // AI_KEY_INTEGRATION's literal values are IntegrationProvider enum names
      // (lib/integrations/registry.ts fails to compile if one isn't).
      where: { provider: AI_KEY_INTEGRATION[provider] satisfies IntegrationProvider },
      select: { encryptedCredentials: true },
    });
    return row?.encryptedCredentials ?? null;
  },
  decrypt: (packed) => decryptJson<{ apiKey?: unknown }>(packed),
  env: process.env,
  log: (message) => console.error(message),
};

/** The key and where it came from. Server-only — callers must never return `key` to a client or log it. */
export async function resolveAiApiKey(provider: string): Promise<ResolvedAiKey> {
  return resolveKeyWith(provider, liveDeps);
}

/** The decrypted admin key if one is stored, else the env var, else null. Never throws. */
export async function getAiApiKey(provider: string): Promise<string | null> {
  return (await resolveAiApiKey(provider)).key;
}

