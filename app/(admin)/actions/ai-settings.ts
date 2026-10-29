"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { buildImageProvider, buildTextProvider } from "@/lib/content-pipeline/providers";
import {
  IMAGE_PROVIDERS,
  MODEL_NAME_PATTERN,
  PROVIDER_KEY_ENV,
  PROVIDER_LABEL,
  TEXT_PROVIDERS,
  hasProviderKey,
  resolveAiConfig,
} from "@/lib/content-pipeline/providers/config";
import { PRICED_IMAGE_MODELS, PRICED_TEXT_MODELS } from "@/lib/content-pipeline/pricing";

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

export interface AiProviderSettingsView {
  saved: { textProvider: string | null; textModel: string | null; imageProvider: string | null; imageModel: string | null; updatedAt: string | null };
  env: { textProvider: string; imageProvider: string };
  active: { text: { provider: string; model: string; source: "admin" | "env" }; image: { provider: string; model: string; source: "admin" | "env" } };
  textProviders: AiProviderOption[];
  imageProviders: AiProviderOption[];
}

function textOption(id: string): AiProviderOption {
  return {
    id,
    label: PROVIDER_LABEL[id],
    keyEnv: PROVIDER_KEY_ENV[id],
    hasKey: hasProviderKey(id),
    defaultModel: buildTextProvider(id).model,
    pricedModels: PRICED_TEXT_MODELS.filter((m) => m.provider === id).map((m) => m.model),
  };
}

function imageOption(id: string): AiProviderOption {
  return {
    id,
    label: PROVIDER_LABEL[id],
    keyEnv: PROVIDER_KEY_ENV[id],
    hasKey: hasProviderKey(id),
    defaultModel: buildImageProvider(id).model,
    pricedModels: PRICED_IMAGE_MODELS.filter((m) => m.provider === id).map((m) => m.model),
  };
}

export async function getAiProviderSettings(): Promise<Result<AiProviderSettingsView>> {
  try {
    await requirePermission("INTEGRATION_MANAGEMENT");
    const row = await prisma.aiSettings.findUnique({ where: { id: "global" } });
    const { text, image } = await resolveAiConfig();
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
          text: { provider: text.provider, model: buildTextProvider(text.provider, text.model).model, source: text.source },
          image: { provider: image.provider, model: buildImageProvider(image.provider, image.model).model, source: image.source },
        },
        textProviders: TEXT_PROVIDERS.map(textOption),
        imageProviders: IMAGE_PROVIDERS.map(imageOption),
      },
    };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to load AI provider settings:", error);
    return { success: false, error: "Couldn't load AI provider settings. If this is a fresh deploy, the add_ai_settings migration may not have been applied yet." };
  }
}

const modelField = z
  .string()
  .trim()
  .max(100)
  .refine((v) => v === "" || MODEL_NAME_PATTERN.test(v), "Model names may only contain letters, numbers, dots, dashes, underscores and colons.")
  .transform((v) => (v === "" ? null : v));

const saveSchema = z.object({
  // null = "use the env var" for that slot.
  textProvider: z.enum(TEXT_PROVIDERS).nullable(),
  textModel: modelField,
  imageProvider: z.enum(IMAGE_PROVIDERS).nullable(),
  imageModel: modelField,
});

export async function saveAiProviderSettings(input: unknown): Promise<Result<null>> {
  try {
    const session = await requirePermission("INTEGRATION_MANAGEMENT");
    const parsed = saveSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
    const data = parsed.data;

    // A model override only means anything alongside an explicit provider.
    const textModel = data.textProvider ? data.textModel : null;
    const imageModel = data.imageProvider ? data.imageModel : null;

    // Refuse a selection that would fail on the very next AI call. Keys
    // live in env vars, so they can't be fixed from here — say which one.
    for (const provider of [data.textProvider, data.imageProvider]) {
      if (provider && !hasProviderKey(provider)) {
        return { success: false, error: `${PROVIDER_LABEL[provider]} can't be selected: ${PROVIDER_KEY_ENV[provider]} isn't configured on the server.` };
      }
    }

    const before = await prisma.aiSettings.findUnique({ where: { id: "global" } });
    const values = { textProvider: data.textProvider, textModel, imageProvider: data.imageProvider, imageModel, updatedById: session.user.id };
    await prisma.aiSettings.upsert({ where: { id: "global" }, create: { id: "global", ...values }, update: values });

    await logAudit({
      action: "update",
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
    console.error("Failed to save AI provider settings:", error);
    return { success: false, error: "Failed to save AI provider settings" };
  }
}

const testSchema = z.object({ provider: z.enum(TEXT_PROVIDERS), model: modelField });

/**
 * One tiny real completion against the chosen text provider/model, before
 * saving it — catches a wrong model name or a revoked key up front instead
 * of on the next pipeline run. Costs a fraction of a cent; deliberately not
 * recorded as an AiJob, since it isn't pipeline work. There's no image
 * equivalent: the cheapest real image test still bills for a full image.
 */
export async function testAiProviderConnection(input: unknown): Promise<Result<{ model: string; latencyMs: number; reply: string }>> {
  try {
    await requirePermission("INTEGRATION_MANAGEMENT");
    const parsed = testSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid provider/model" };

    const provider = buildTextProvider(parsed.data.provider, parsed.data.model);
    const started = Date.now();
    // Generous token cap: reasoning models (e.g. gpt-5) spend part of the
    // budget before writing visible text, and too low a cap reads as an
    // empty reply rather than a success.
    const result = await provider.complete("You are a connectivity check.", "Reply with exactly: OK", 512);
    return { success: true, data: { model: provider.model, latencyMs: Date.now() - started, reply: result.text.trim().slice(0, 100) } };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message.slice(0, 500) };
  }
}
