import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { computeHealthScores } from "./score";

type StageResult<T> = { success: true; data: T } | { success: false; error: string };

function fail(error: string): StageResult<never> {
  return { success: false, error };
}

/**
 * No auth check — callable from a cron context (app/api/cron/
 * content-health-scan), same pattern as the other scan-and-persist
 * functions in lib/content-refresh, lib/content-recommendations, and
 * lib/content-cannibalization. Unlike those, there's no lifecycle status
 * to preserve here — a health score is a snapshot, so every rescan just
 * overwrites the existing row for that content outright.
 */
export async function runHealthScan(): Promise<{ scored: number }> {
  const results = await computeHealthScores();

  for (const r of results) {
    await prisma.contentHealthScore.upsert({
      where: { contentType_contentId: { contentType: r.contentType, contentId: r.contentId } },
      create: { contentType: r.contentType, contentId: r.contentId, overallScore: r.overallScore, grade: r.grade, factors: JSON.stringify(r.factors) },
      update: { overallScore: r.overallScore, grade: r.grade, factors: JSON.stringify(r.factors) },
    });
  }

  revalidatePath("/admin/content-health");
  return { scored: results.length };
}

export async function scanAndUpsertHealthScores(): Promise<StageResult<{ scored: number }>> {
  try {
    await requirePermission("EDIT");
    const result = await runHealthScan();
    return { success: true, data: result };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error("Content health scan failed:", error);
    return fail("Scan failed");
  }
}

export async function listHealthScores() {
  try {
    await requirePermission("EDIT");
    const scores = await prisma.contentHealthScore.findMany({ orderBy: [{ overallScore: "asc" }] });

    const postIds = scores.filter((s) => s.contentType === "POST").map((s) => s.contentId);
    const caseIds = scores.filter((s) => s.contentType === "CASE_STUDY").map((s) => s.contentId);
    const [posts, caseStudies] = await Promise.all([
      prisma.post.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true, slug: true } }),
      prisma.caseStudy.findMany({ where: { id: { in: caseIds } }, select: { id: true, title: true, slug: true } }),
    ]);
    const lookup = new Map([...posts, ...caseStudies].map((c) => [c.id, { title: c.title, slug: c.slug }]));

    return scores.map((s) => ({ ...s, content: lookup.get(s.contentId) ?? null })).filter((s) => s.content !== null);
  } catch (error) {
    console.error("Failed to list content health scores:", error);
    return [];
  }
}
