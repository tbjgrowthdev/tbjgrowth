import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import type { RecommendationCandidate } from "./types";
import { scanForRecommendationCandidates } from "./detect";

type StageResult<T> = { success: true; data: T } | { success: false; error: string };

function fail(error: string): StageResult<never> {
  return { success: false, error };
}

const DEFAULT_INTERVAL_DAYS = 14; // used when there's not enough publish history to infer a real cadence
const MIN_INTERVAL_DAYS = 7;
const MAX_INTERVAL_DAYS = 30;

/**
 * How often this site has actually been publishing lately — the spacing
 * suggestedPublishAt uses, rather than inventing a generic "once a week"
 * assumption that may not match reality. Needs at least 2 publish dates
 * in the last 180 days to trust the average; otherwise falls back to the
 * default. Clamped so one unusually bursty or quiet stretch can't produce
 * a nonsensical 1-day or 90-day spacing.
 */
async function inferPublishIntervalDays(): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 180);
  const [posts, caseStudies] = await Promise.all([
    prisma.post.findMany({ where: { status: "PUBLISHED", publishedAt: { gte: since } }, select: { publishedAt: true } }),
    prisma.caseStudy.findMany({ where: { status: "PUBLISHED", publishedAt: { gte: since } }, select: { publishedAt: true } }),
  ]);
  const dates = [...posts, ...caseStudies]
    .map((p) => p.publishedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length < 2) return DEFAULT_INTERVAL_DAYS;
  const totalSpanDays = (dates[dates.length - 1].getTime() - dates[0].getTime()) / 86_400_000;
  const avgInterval = totalSpanDays / (dates.length - 1);
  return Math.min(MAX_INTERVAL_DAYS, Math.max(MIN_INTERVAL_DAYS, Math.round(avgInterval)));
}

type ScoredCandidate = RecommendationCandidate & { priority: "HIGH" | "MEDIUM" | "LOW"; suggestedPublishAt: Date };

function bucketAndSchedule(candidates: RecommendationCandidate[], intervalDays: number): ScoredCandidate[] {
  const ranked = [...candidates].sort((a, b) => b.priorityScore - a.priorityScore);
  const tertile = Math.ceil(ranked.length / 3);
  const today = new Date();

  return ranked.map((c, i) => {
    const priority: "HIGH" | "MEDIUM" | "LOW" = i < tertile ? "HIGH" : i < tertile * 2 ? "MEDIUM" : "LOW";
    const suggestedPublishAt = new Date(today.getTime() + i * intervalDays * 86_400_000);
    return { ...c, priority, suggestedPublishAt };
  });
}

const ACTIONED_STATUSES = ["IN_PROGRESS", "DISMISSED"] as const;

/**
 * The actual scan+persist logic, with no auth check — callable from a
 * cron context (app/api/cron/content-recommendations-scan), same pattern
 * as content-refresh/refresh.ts's runRefreshScan. A row already marked
 * IN_PROGRESS or DISMISSED is left untouched on rescan — only NEW rows
 * get their score/priority/schedule refreshed, and a keyword with no
 * remaining gap just stops being upserted (its existing row, if any,
 * stays as whatever status it was last at).
 */
export async function runRecommendationScan(): Promise<{ flagged: number }> {
  const [candidates, intervalDays] = await Promise.all([scanForRecommendationCandidates(), inferPublishIntervalDays()]);
  const scheduled = bucketAndSchedule(candidates, intervalDays);

  for (const c of scheduled) {
    const existing = await prisma.contentRecommendation.findUnique({ where: { keyword: c.keyword } });
    if (existing && ACTIONED_STATUSES.includes(existing.status as (typeof ACTIONED_STATUSES)[number])) continue;

    await prisma.contentRecommendation.upsert({
      where: { keyword: c.keyword },
      create: {
        keyword: c.keyword,
        topic: c.topic,
        suggestedFormat: c.suggestedFormat,
        contentType: c.contentType,
        priority: c.priority,
        priorityScore: c.priorityScore,
        reasoning: c.reasoning,
        suggestedPublishAt: c.suggestedPublishAt,
        source: c.source,
      },
      update: {
        topic: c.topic,
        suggestedFormat: c.suggestedFormat,
        contentType: c.contentType,
        priority: c.priority,
        priorityScore: c.priorityScore,
        reasoning: c.reasoning,
        suggestedPublishAt: c.suggestedPublishAt,
        source: c.source,
      },
    });
  }

  revalidatePath("/admin/content-recommendations");
  return { flagged: scheduled.length };
}

export async function scanAndUpsertRecommendations(): Promise<StageResult<{ flagged: number }>> {
  try {
    await requirePermission("EDIT");
    const result = await runRecommendationScan();
    return { success: true, data: result };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error("Content recommendations scan failed:", error);
    return fail("Scan failed");
  }
}

export async function listRecommendations() {
  try {
    await requirePermission("EDIT");
    return prisma.contentRecommendation.findMany({
      where: { status: { not: "DISMISSED" } },
      orderBy: [{ priorityScore: "desc" }],
    });
  } catch (error) {
    console.error("Failed to list content recommendations:", error);
    return [];
  }
}

export async function dismissRecommendation(id: string): Promise<StageResult<null>> {
  try {
    await requirePermission("EDIT");
    await prisma.contentRecommendation.update({ where: { id }, data: { status: "DISMISSED" } });
    revalidatePath("/admin/content-recommendations");
    return { success: true, data: null };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to dismiss content recommendation ${id}:`, error);
    return fail("Failed to dismiss recommendation");
  }
}

/**
 * Called when an admin clicks "Create Content" on a recommendation,
 * before they're sent to the pre-filled Brief form — bookkeeping only
 * (it doesn't create a Post/CaseStudy itself; that still only happens if
 * they actually submit the Brief, same CREATE-gated path as any other
 * pipeline run). Marks the row so a rescan doesn't keep re-suggesting a
 * topic that's already being worked on.
 */
export async function markRecommendationInProgress(id: string): Promise<StageResult<null>> {
  try {
    await requirePermission("EDIT");
    await prisma.contentRecommendation.update({ where: { id }, data: { status: "IN_PROGRESS" } });
    revalidatePath("/admin/content-recommendations");
    return { success: true, data: null };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to mark content recommendation ${id} in progress:`, error);
    return fail("Failed to update recommendation");
  }
}
