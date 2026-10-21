"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { getExperimentableContent } from "@/lib/seo-experiments/content-access";
import { createExperiment, launchExperiment, revertExperiment, evaluateExperiment } from "@/lib/seo-experiments/lifecycle";
import type { ExperimentContentType, ExperimentResults, ExperimentVariable } from "@/lib/seo-experiments/types";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function getExperimentableContentAction() {
  try {
    await requireSession();
    return await getExperimentableContent();
  } catch (error) {
    console.error("Failed to list experimentable content:", error);
    return [];
  }
}

export async function getSeoExperiments() {
  try {
    await requireSession();
    const [experiments, content] = await Promise.all([
      prisma.seoExperiment.findMany({ orderBy: { createdAt: "desc" } }),
      getExperimentableContent(),
    ]);
    const byKey = new Map(content.map((c) => [`${c.contentType}:${c.contentId}`, c]));
    return experiments.map((e) => ({
      ...e,
      content: byKey.get(`${e.contentType}:${e.contentId}`) ?? null,
      results: e.results ? (JSON.parse(e.results) as ExperimentResults) : null,
    }));
  } catch (error) {
    console.error("Failed to list SEO experiments:", error);
    return [];
  }
}

export async function getSeoExperiment(id: string) {
  try {
    await requireSession();
    const experiment = await prisma.seoExperiment.findUnique({ where: { id } });
    if (!experiment) return null;
    const content = await getExperimentableContent();
    const match = content.find((c) => c.contentType === experiment.contentType && c.contentId === experiment.contentId) ?? null;
    return { ...experiment, content: match, results: experiment.results ? (JSON.parse(experiment.results) as ExperimentResults) : null };
  } catch (error) {
    console.error(`Failed to fetch SEO experiment ${id}:`, error);
    return null;
  }
}

export async function createSeoExperimentAction(input: {
  name: string;
  contentType: ExperimentContentType;
  contentId: string;
  variable: ExperimentVariable;
  afterValue: string;
  baselineWindowDays: number;
  evaluationWindowDays: number;
}): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("CREATE");
    const result = await createExperiment(input);
    revalidatePath("/admin/seo-experiments");
    await logAudit({ action: "create", category: "Content", entityType: "SeoExperiment", entityId: result.id, entityLabel: input.name });
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to create SEO experiment:", error);
    return { success: false, error: errorMessage(error, "Failed to create experiment") };
  }
}

export async function launchSeoExperimentAction(id: string): Promise<ActionResult<null>> {
  try {
    await requirePermission("EDIT");
    await launchExperiment(id);
    revalidatePath("/admin/seo-experiments");
    await logAudit({ action: "update", category: "Content", entityType: "SeoExperiment", entityId: id, entityLabel: "Launched" });
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error(`Failed to launch SEO experiment ${id}:`, error);
    return { success: false, error: errorMessage(error, "Failed to launch experiment") };
  }
}

export async function revertSeoExperimentAction(id: string): Promise<ActionResult<null>> {
  try {
    await requirePermission("EDIT");
    await revertExperiment(id);
    revalidatePath("/admin/seo-experiments");
    await logAudit({ action: "update", category: "Content", entityType: "SeoExperiment", entityId: id, entityLabel: "Reverted" });
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error(`Failed to revert SEO experiment ${id}:`, error);
    return { success: false, error: errorMessage(error, "Failed to revert experiment") };
  }
}

export async function evaluateSeoExperimentAction(id: string): Promise<ActionResult<{ results: ExperimentResults; isWindowComplete: boolean; daysElapsed: number; daysRemaining: number }>> {
  try {
    await requireSession();
    const result = await evaluateExperiment(id);
    revalidatePath("/admin/seo-experiments");
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error(`Failed to evaluate SEO experiment ${id}:`, error);
    return { success: false, error: errorMessage(error, "Failed to evaluate experiment") };
  }
}

export async function deleteSeoExperimentAction(id: string): Promise<ActionResult<null>> {
  try {
    await requirePermission("DELETE");
    const before = await prisma.seoExperiment.findUnique({ where: { id } });
    await prisma.seoExperiment.delete({ where: { id } });
    revalidatePath("/admin/seo-experiments");
    await logAudit({ action: "delete", category: "Content", entityType: "SeoExperiment", entityId: id, entityLabel: before?.name });
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error(`Failed to delete SEO experiment ${id}:`, error);
    return { success: false, error: errorMessage(error, "Failed to delete experiment") };
  }
}
