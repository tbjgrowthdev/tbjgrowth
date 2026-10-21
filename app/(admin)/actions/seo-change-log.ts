"use server";

import { requireSession, AuthError } from "@/lib/auth-guard";
import { getSeoChangeLog, type SeoChangeLogFilters } from "@/lib/seo-change-log/build";
import { computeChangeImpact, type ChangeImpact } from "@/lib/seo-change-log/impact";
import type { ExperimentContentType } from "@/lib/seo-experiments/types";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function getSeoChangeLogAction(filters: SeoChangeLogFilters = {}) {
  try {
    await requireSession();
    return await getSeoChangeLog(filters);
  } catch (error) {
    console.error("Failed to load SEO change log:", error);
    return [];
  }
}

export async function getChangeImpactAction(
  contentType: ExperimentContentType,
  contentId: string,
  changedAt: string,
  windowDays?: number
): Promise<ActionResult<ChangeImpact>> {
  try {
    await requireSession();
    const data = await computeChangeImpact(contentType, contentId, new Date(changedAt), windowDays);
    return { success: true, data };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to compute change impact:", error);
    return { success: false, error: errorMessage(error, "Failed to compute change impact") };
  }
}
