import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { callAiForJson } from "@/lib/content-pipeline/ai";
import { completeJob, createPerformanceFeedbackJob, failJob } from "@/lib/content-pipeline/jobs";
import { collectPerformanceSignals } from "./collect";
import { buildPerformanceFeedbackPrompt } from "./prompts";
import { deriveSeverity } from "./types";
import type { PerformanceSignal } from "./types";
import { fireAutomationEvent } from "@/lib/automation/engine";
import type { AutomationEvent } from "@/lib/generated/prisma/client";

type StageResult<T> = { success: true; data: T } | { success: false; error: string };

function fail(error: string): StageResult<never> {
  return { success: false, error };
}

const ACTIONED_STATUSES = ["DISMISSED"] as const;

async function lookupTitles(candidates: { contentType: "POST" | "CASE_STUDY"; contentId: string }[]) {
  const postIds = candidates.filter((c) => c.contentType === "POST").map((c) => c.contentId);
  const caseIds = candidates.filter((c) => c.contentType === "CASE_STUDY").map((c) => c.contentId);
  const [posts, caseStudies] = await Promise.all([
    prisma.post.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true, slug: true } }),
    prisma.caseStudy.findMany({ where: { id: { in: caseIds } }, select: { id: true, title: true, slug: true } }),
  ]);
  return new Map([...posts, ...caseStudies].map((c) => [c.id, { title: c.title, slug: c.slug }]));
}

/**
 * The actual scan+persist logic, with no auth check — same callable-from-
 * a-cron-context shape as content-refresh/refresh.ts's runRefreshScan and
 * content-cannibalization/cannibalization.ts's runCannibalizationScan.
 * Unlike those, this one makes one AI call per flagged piece of content
 * (to turn the raw signals into a plain-English diagnosis +
 * recommendations) — real, billed calls, same cost-tracking treatment as
 * every other AI call in this codebase via AiJob. A row already DISMISSED
 * is left untouched; a rescan only refreshes OPEN rows or creates new ones
 * for content that wasn't previously flagged.
 */
export async function runPerformanceFeedbackScan(): Promise<{ flagged: number; failed: number }> {
  const candidates = await collectPerformanceSignals();
  const titles = await lookupTitles(candidates);

  let flagged = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const existing = await prisma.performanceFeedback.findUnique({
      where: { contentType_contentId: { contentType: candidate.contentType, contentId: candidate.contentId } },
    });
    if (existing && ACTIONED_STATUSES.includes(existing.status as (typeof ACTIONED_STATUSES)[number])) continue;

    const content = titles.get(candidate.contentId);
    const title = content?.title ?? candidate.contentId;
    const severity = deriveSeverity(candidate.signals);
    const signalsJson = JSON.stringify(candidate.signals);
    const previousTypes = new Set(existing ? (JSON.parse(existing.signals) as PerformanceSignal[]).map((s) => s.type) : []);
    const newlyAppeared = candidate.signals.filter((s) => !previousTypes.has(s.type));

    // Signals/severity are persisted up front (and kept even if the AI
    // call below fails) — the row needs a real id before a job can be
    // attached to it, and the detected signals themselves are already
    // real, useful data on their own.
    const row = await prisma.performanceFeedback.upsert({
      where: { contentType_contentId: { contentType: candidate.contentType, contentId: candidate.contentId } },
      create: {
        contentType: candidate.contentType,
        contentId: candidate.contentId,
        signals: signalsJson,
        severity,
        aiSummary: "",
        aiRecommendations: "[]",
      },
      update: { signals: signalsJson, severity, status: "OPEN" },
    });

    const job = await createPerformanceFeedbackJob(row.id, candidate.contentId);
    let aiSummary = "";
    let aiRecommendations: string[] = [];
    try {
      const prompt = buildPerformanceFeedbackPrompt({ title, signals: candidate.signals as PerformanceSignal[] });
      const { data, usage } = await callAiForJson<{ summary: string; recommendations: string[] }>(prompt.system, prompt.user, 1024);
      aiSummary = data.summary;
      aiRecommendations = data.recommendations;

      await prisma.performanceFeedback.update({
        where: { id: row.id },
        data: { aiSummary: data.summary, aiRecommendations: JSON.stringify(data.recommendations) },
      });
      await completeJob(job.id, { usage });
      flagged++;
    } catch (stageError) {
      const message = stageError instanceof Error ? stageError.message : String(stageError);
      await failJob(job.id, message);
      console.error(`Performance feedback AI call failed for ${candidate.contentType}:${candidate.contentId}:`, stageError);
      failed++;
    }

    // One automation event per newly-appeared signal type — an ongoing
    // decline that was already flagged on a prior scan doesn't re-fire,
    // only a signal type this content didn't have before does.
    for (const signal of newlyAppeared) {
      await fireAutomationEvent(signal.type as AutomationEvent, candidate.contentType, candidate.contentId, {
        title,
        severity,
        feedbackId: row.id,
        aiSummary,
        aiRecommendations,
        signals: candidate.signals,
      });
    }
  }

  revalidatePath("/admin/seo-performance-feedback");
  return { flagged, failed };
}

export async function scanAndUpsertPerformanceFeedback(): Promise<StageResult<{ flagged: number; failed: number }>> {
  try {
    await requirePermission("EDIT");
    const result = await runPerformanceFeedbackScan();
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message);
    console.error("SEO performance feedback scan failed:", error);
    return fail("Scan failed");
  }
}

export async function listPerformanceFeedback() {
  try {
    await requirePermission("EDIT");
    const rows = await prisma.performanceFeedback.findMany({ where: { status: "OPEN" }, orderBy: { updatedAt: "desc" } });
    // Sorted in JS, not via Prisma orderBy — enum declaration order (HIGH,
    // MEDIUM, LOW) isn't guaranteed to be what the database sorts by.
    const SEVERITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
    const sorted = [...rows].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    const titles = await lookupTitles(sorted.map((r) => ({ contentType: r.contentType as "POST" | "CASE_STUDY", contentId: r.contentId })));
    return sorted.map((r) => ({ ...r, content: titles.get(r.contentId) ?? null }));
  } catch (error) {
    console.error("Failed to list SEO performance feedback:", error);
    return [];
  }
}

export async function dismissPerformanceFeedback(id: string): Promise<StageResult<null>> {
  try {
    await requirePermission("EDIT");
    await prisma.performanceFeedback.update({ where: { id }, data: { status: "DISMISSED" } });
    revalidatePath("/admin/seo-performance-feedback");
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to dismiss performance feedback ${id}:`, error);
    return fail("Failed to dismiss");
  }
}
