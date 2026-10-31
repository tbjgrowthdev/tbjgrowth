"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { encryptJson } from "@/lib/integrations/crypto";
import { AI_KEY_REGISTRY } from "@/lib/integrations/registry";
import { buildTextProvider, resolveImageModel, resolveTextModel } from "@/lib/content-pipeline/providers";
import { AI_KEY_PROVIDERS, IMAGE_PROVIDERS, PROVIDER_KEY_ENV, PROVIDER_LABEL, TEXT_PROVIDERS, isValidModelName, keyLast4, maskKey, redactSecret } from "@/lib/content-pipeline/providers/catalog";
import { resolveAiConfig } from "@/lib/content-pipeline/providers/config";
import { resolveAiApiKey, type AiKeySource } from "@/lib/content-pipeline/providers/keys";
import { PRICED_IMAGE_MODELS, PRICED_TEXT_MODELS } from "@/lib/content-pipeline/pricing";

// SECRET HANDLING — every function below follows the same rules:
// - A plaintext API key exists only in this process's memory: from the save
//   form until encryptJson(), or from decryptJson() until the provider call.
// - Nothing returned to the client, logged, or written to the audit log ever
//   contains it. The only key-derived value that leaves the server is
//   maskKey()'s "••••" + last 4 characters.
// - Error messages are built from fixed strings, or passed through
//   redactSecret() when they come from a provider's response.

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface AiProviderOption {
  id: string;
  label: string;
  keyEnv: string;
  hasKey: boolean;
  /** The model this provider uses when no override is saved — its *_MODEL env var, else the built-in default. */
  defaultModel: string;
  /** Models cost tracking has prices for. Anything else still works; its jobs just record no cost. */
  pricedModels: string[];
}

export interface AiKeyStatus {
  provider: string;
  label: string;
  keyEnv: string;
  /** Which key AI calls will use right now: one entered here, the env var, or none. */
  source: AiKeySource;
  /** "••••abcd" — never more than the last 4 characters. */
  maskedKey: string | null;
  /** A key is stored here but couldn't be decrypted (e.g. INTEGRATION_ENCRYPTION_KEY was rotated), so calls fall back to the env var. */
  storedKeyUnreadable: boolean;
  updatedAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
}

export interface AiProviderSettingsView {
  saved: { textProvider: string | null; textModel: string | null; imageProvider: string | null; imageModel: string | null; updatedAt: string | null };
  env: { textProvider: string; imageProvider: string };
  active: { text: { provider: string; model: string; source: "admin" | "env" }; image: { provider: string; model: string; source: "admin" | "env" } };
  textProviders: AiProviderOption[];
  imageProviders: AiProviderOption[];
  keys: AiKeyStatus[];
  /** False when the Integration table can't hold AI keys yet (migration not applied) — keys can still come from env vars. */
  keyStoreAvailable: boolean;
}

type StoredKeyRow = { provider: string; encryptedCredentials: string | null; updatedAt: Date; lastCheckedAt: Date | null; lastError: string | null };

async function readStoredKeyRows(): Promise<{ rows: Map<string, StoredKeyRow>; available: boolean }> {
  try {
    const rows = await prisma.integration.findMany({
      where: { provider: { in: AI_KEY_PROVIDERS.map((p) => AI_KEY_REGISTRY[p].id) } },
      select: { provider: true, encryptedCredentials: true, updatedAt: true, lastCheckedAt: true, lastError: true },
    });
    return { rows: new Map(rows.map((r) => [r.provider as string, r])), available: true };
  } catch (error) {
    console.error("AI key store unavailable (has the add_ai_provider_keys migration been applied?):", error instanceof Error ? error.message : "unknown error");
    return { rows: new Map(), available: false };
  }
}

async function keyStatus(provider: (typeof AI_KEY_PROVIDERS)[number], rows: Map<string, StoredKeyRow>): Promise<AiKeyStatus> {
  const def = AI_KEY_REGISTRY[provider];
  const row = rows.get(def.id);
  const resolved = await resolveAiApiKey(provider);
  return {
    provider,
    label: def.label,
    keyEnv: def.envVar,
    source: resolved.source,
    maskedKey: maskKey(resolved.key),
    storedKeyUnreadable: !!row?.encryptedCredentials && resolved.source !== "admin",
    updatedAt: row?.updatedAt.toISOString() ?? null,
    lastCheckedAt: row?.lastCheckedAt?.toISOString() ?? null,
    lastError: row?.lastError ?? null,
  };
}

function option(id: string, keys: AiKeyStatus[], kind: "text" | "image"): AiProviderOption {
  return {
    id,
    label: PROVIDER_LABEL[id],
    keyEnv: PROVIDER_KEY_ENV[id],
    hasKey: keys.find((k) => k.provider === id)?.source !== "none",
    defaultModel: kind === "text" ? resolveTextModel(id) : resolveImageModel(id),
    pricedModels: (kind === "text" ? PRICED_TEXT_MODELS : PRICED_IMAGE_MODELS).filter((m) => m.provider === id).map((m) => m.model),
  };
}

export async function getAiProviderSettings(): Promise<Result<AiProviderSettingsView>> {
  try {
    await requirePermission("INTEGRATION_MANAGEMENT");
    const row = await prisma.aiSettings.findUnique({ where: { id: "global" } });
    const { text, image } = await resolveAiConfig();
    const store = await readStoredKeyRows();
    const keys = await Promise.all(AI_KEY_PROVIDERS.map((p) => keyStatus(p, store.rows)));
    return {
      success: true,
      data: {
        saved: {
          textProvider: row?.textProvider ?? null,
          textModel: row?.textModel ?? null,
          imageProvider: row?.imageProvider ?? null,
          imageModel: row?.imageModel ?? null,
          updatedAt: row?.updatedAt.toISOString() ?? null,
        },
        env: {
          textProvider: (process.env.AI_PROVIDER || "anthropic").toLowerCase(),
          imageProvider: (process.env.AI_IMAGE_PROVIDER || "openai").toLowerCase(),
        },
        active: {
          text: { provider: text.provider, model: safeModel(() => resolveTextModel(text.provider, text.model)), source: text.source },
          image: { provider: image.provider, model: safeModel(() => resolveImageModel(image.provider, image.model)), source: image.source },
        },
        textProviders: TEXT_PROVIDERS.map((id) => option(id, keys, "text")),
        imageProviders: IMAGE_PROVIDERS.map((id) => option(id, keys, "image")),
        keys,
        keyStoreAvailable: store.available,
      },
    };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to load AI provider settings:", error instanceof Error ? error.message : "unknown error");
    return { success: false, error: "Couldn't load AI provider settings. If this is a fresh deploy, the add_ai_settings migration may not have been applied yet." };
  }
}

// An env var naming an unknown provider (e.g. AI_PROVIDER=typo) shouldn't take the whole settings screen down.
function safeModel(fn: () => string): string {
  try {
    return fn();
  } catch {
    return "unknown provider";
  }
}

const MODEL_ERROR = "Model names may only contain letters, numbers, dots, dashes, underscores and colons (OpenRouter ids may also contain one \"/\", e.g. vendor/model).";

const modelField = z
  .string()
  .trim()
  .max(160)
  .transform((v) => (v === "" ? null : v));

const saveSchema = z
  .object({
    // null = "use the env var" for that slot.
    textProvider: z.enum(TEXT_PROVIDERS).nullable(),
    textModel: modelField,
    imageProvider: z.enum(IMAGE_PROVIDERS).nullable(),
    imageModel: modelField,
  })
  .refine((d) => !d.textProvider || d.textModel === null || isValidModelName(d.textProvider, d.textModel), MODEL_ERROR)
  .refine((d) => !d.imageProvider || d.imageModel === null || isValidModelName(d.imageProvider, d.imageModel), MODEL_ERROR);

export async function saveAiProviderSettings(input: unknown): Promise<Result<null>> {
  try {
    const session = await requirePermission("INTEGRATION_MANAGEMENT");
    const parsed = saveSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
    const data = parsed.data;

    // A model override only means anything alongside an explicit provider.
    const textModel = data.textProvider ? data.textModel : null;
    const imageModel = data.imageProvider ? data.imageModel : null;

    // Refuse a selection that would fail on the very next AI call.
    for (const provider of [data.textProvider, data.imageProvider]) {
      if (provider && (await resolveAiApiKey(provider)).source === "none") {
        return { success: false, error: `${PROVIDER_LABEL[provider]} can't be selected: add its API key below, or set ${PROVIDER_KEY_ENV[provider]} on the server.` };
      }
    }

    const before = await prisma.aiSettings.findUnique({ where: { id: "global" } });
    const values = { textProvider: data.textProvider, textModel, imageProvider: data.imageProvider, imageModel, updatedById: session.user.id };
    await prisma.aiSettings.upsert({ where: { id: "global" }, create: { id: "global", ...values }, update: values });

    const switched = (before?.textProvider ?? null) !== data.textProvider || (before?.imageProvider ?? null) !== data.imageProvider;
    await logAudit({
      // The actor (user id/name/role) is recorded by logAudit from the session.
      action: switched ? "ai_provider_switched" : "update",
      category: "Integrations",
      entityType: "AiSettings",
      entityId: "global",
      entityLabel: "AI provider selection",
      before: before ? { textProvider: before.textProvider, textModel: before.textModel, imageProvider: before.imageProvider, imageModel: before.imageModel } : undefined,
      after: { textProvider: data.textProvider, textModel, imageProvider: data.imageProvider, imageModel },
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin/integrations");
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to save AI provider settings:", error instanceof Error ? error.message : "unknown error");
    return { success: false, error: "Failed to save AI provider settings" };
  }
}

// Printable ASCII with no whitespace: every vendor's keys fit this, and it
// rules out a pasted newline/space silently becoming part of the key.
const API_KEY_PATTERN = /^[\x21-\x7E]{8,512}$/;

const saveKeySchema = z.object({
  provider: z.enum(AI_KEY_PROVIDERS),
  // Fixed error messages only — zod must never echo the submitted value.
  apiKey: z
    .string({ error: "Enter an API key." })
    .trim()
    .refine((v) => API_KEY_PATTERN.test(v), { error: "That doesn't look like an API key (8–512 characters, no spaces)." }),
});

/** Saves or replaces an admin-entered API key, encrypted. Returns only the masked status, never the key. */
export async function saveAiProviderKey(input: unknown): Promise<Result<AiKeyStatus>> {
  try {
    const session = await requirePermission("INTEGRATION_MANAGEMENT");
    const parsed = saveKeySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid API key" };
    const { provider, apiKey } = parsed.data;
    const def = AI_KEY_REGISTRY[provider];

    const encryptedCredentials = encryptJson({ apiKey });
    const metadata = JSON.stringify({ last4: keyLast4(apiKey) });
    const existing = await prisma.integration.findUnique({ where: { provider: def.id }, select: { id: true } });

    // A single upsert — no interactive transaction needed (Neon HTTP adapter).
    const row = await prisma.integration.upsert({
      where: { provider: def.id },
      // CONNECTED = "a key is stored"; it isn't verified until Test connection runs.
      create: { provider: def.id, encryptedCredentials, metadata, status: "CONNECTED", connectedAt: new Date(), connectedById: session.user.id },
      update: { encryptedCredentials, metadata, status: "CONNECTED", lastError: null, lastCheckedAt: null, connectedAt: new Date(), connectedById: session.user.id },
      select: { id: true },
    });

    await logAudit({
      action: existing ? "ai_key_replaced" : "ai_key_set",
      category: "Integrations",
      entityType: "Integration",
      entityId: row.id,
      entityLabel: `${def.label} API key`,
      // Provider name only — never the key, its ciphertext, or any part of it.
      after: { provider },
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin/integrations");
    const store = await readStoredKeyRows();
    return { success: true, data: await keyStatus(provider, store.rows) };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    // Deliberately not logging `error` itself: its message could carry the
    // Prisma invocation's arguments. Its class name is enough to triage.
    console.error(`Failed to save AI API key (${error instanceof Error ? error.name : "unknown error"})`);
    const misconfigured = error instanceof Error && error.message.includes("INTEGRATION_ENCRYPTION_KEY");
    return {
      success: false,
      error: misconfigured
        ? "Can't store keys: INTEGRATION_ENCRYPTION_KEY is missing or invalid on the server."
        : "Failed to save the API key. If this is a fresh deploy, the add_ai_provider_keys migration may not have been applied yet.",
    };
  }
}

const providerOnlySchema = z.object({ provider: z.enum(AI_KEY_PROVIDERS) });

/** Deletes the admin-entered key; AI calls fall back to the env var (if set) from the next call on. */
export async function removeAiProviderKey(input: unknown): Promise<Result<AiKeyStatus>> {
  try {
    await requirePermission("INTEGRATION_MANAGEMENT");
    const parsed = providerOnlySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Unknown provider" };
    const { provider } = parsed.data;
    const def = AI_KEY_REGISTRY[provider];

    const existing = await prisma.integration.findUnique({ where: { provider: def.id }, select: { id: true } });
    if (existing) {
      await prisma.integration.delete({ where: { provider: def.id } });
      await logAudit({
        action: "ai_key_removed",
        category: "Integrations",
        entityType: "Integration",
        entityId: existing.id,
        entityLabel: `${def.label} API key`,
        before: { provider },
      });
    }

    revalidatePath("/admin/settings");
    revalidatePath("/admin/integrations");
    const store = await readStoredKeyRows();
    return { success: true, data: await keyStatus(provider, store.rows) };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error(`Failed to remove AI API key (${error instanceof Error ? error.message : "unknown error"})`);
    return { success: false, error: "Failed to remove the API key" };
  }
}

const testSchema = z
  .object({ provider: z.enum(TEXT_PROVIDERS), model: modelField })
  .refine((d) => d.model === null || isValidModelName(d.provider, d.model), MODEL_ERROR);

/**
 * One tiny real completion against the chosen text provider/model, using
 * whichever key AI calls would use (admin-entered, else env) — catches a
 * wrong model name or a revoked key up front instead of on the next
 * pipeline run. Costs a fraction of a cent; deliberately not recorded as an
 * AiJob, since it isn't pipeline work. There's no image equivalent: the
 * cheapest real image test still bills for a full image (image keys are the
 * same OpenAI/Gemini keys, so this test covers them).
 */
export async function testAiProviderConnection(input: unknown): Promise<Result<{ model: string; latencyMs: number; reply: string; keySource: AiKeySource }>> {
  let secret: string | null = null;
  try {
    await requirePermission("INTEGRATION_MANAGEMENT");
    const parsed = testSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid provider/model" };
    const { provider: name, model } = parsed.data;

    const resolved = await resolveAiApiKey(name);
    secret = resolved.key;
    if (!resolved.key) return { success: false, error: `No API key for ${PROVIDER_LABEL[name]}: add one below, or set ${PROVIDER_KEY_ENV[name]} on the server.` };

    const provider = await buildTextProvider(name, model);
    const started = Date.now();
    let outcome: { ok: true; reply: string } | { ok: false; error: string };
    try {
      // Generous token cap: reasoning models (e.g. gpt-5) spend part of the
      // budget before writing visible text, and too low a cap reads as an
      // empty reply rather than a success.
      const result = await provider.complete("You are a connectivity check.", "Reply with exactly: OK", 512);
      outcome = { ok: true, reply: result.text.trim().slice(0, 100) };
    } catch (error) {
      outcome = { ok: false, error: redactSecret(error instanceof Error ? error.message : String(error), secret).slice(0, 500) };
    }
    const latencyMs = Date.now() - started;

    // Record the result on the stored key's row (only when that's the key being tested).
    if (resolved.source === "admin") {
      await prisma.integration
        .update({
          where: { provider: AI_KEY_REGISTRY[name].id },
          data: { status: outcome.ok ? "CONNECTED" : "ERROR", lastCheckedAt: new Date(), lastError: outcome.ok ? null : outcome.error },
        })
        .catch(() => console.error(`Couldn't record the ${name} key test result`));
      revalidatePath("/admin/settings");
    }

    if (!outcome.ok) return { success: false, error: outcome.error };
    return { success: true, data: { model: provider.model, latencyMs, reply: redactSecret(outcome.reply, secret), keySource: resolved.source } };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: redactSecret(message, secret).slice(0, 500) };
  }
}
