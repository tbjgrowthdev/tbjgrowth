import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { scanForCannibalizationPairs } from "./detect";

type StageResult<T> = { success: true; data: T } | { success: false; error: string };

function fail(error: string): StageResult<never> {
  return { success: false, error };
}

const ACTIONED_STATUSES = ["RESOLVED", "DISMISSED"] as const;

/**
 * The actual scan+persist logic, with no auth check — callable from a
 * cron context (app/api/cron/content-cannibalization-scan), same pattern
 * as content-refresh/refresh.ts's runRefreshScan and
 * content-recommendations/recommend.ts's runRecommendationScan. A pair
 * already RESOLVED or DISMISSED is left untouched; this system never
 * changes that status itself — only a human clicking Resolve/Dismiss
 * does, after they've handled it (or decided it's not worth handling)
 * outside this feature entirely. See the matching schema comment.
 */
export async function runCannibalizationScan(): Promise<{ flagged: number }> {
  const candidates = await scanForCannibalizationPairs();

  for (const c of candidates) {
    const existing = await prisma.contentCannibalization.findUnique({ where: { contentIdA_contentIdB: { contentIdA: c.contentIdA, contentIdB: c.contentIdB } } });
    if (existing && ACTIONED_STATUSES.includes(existing.status as (typeof ACTIONED_STATUSES)[number])) continue;

    await prisma.contentCannibalization.upsert({
      where: { contentIdA_contentIdB: { contentIdA: c.contentIdA, contentIdB: c.contentIdB } },
      create: {
        contentTypeA: c.contentTypeA,
        contentIdA: c.contentIdA,
        contentTypeB: c.contentTypeB,
        contentIdB: c.contentIdB,
        similarity: c.similarity,
        sharedQueries: JSON.stringify(c.sharedQueries),
        suggestedAction: c.suggestedAction,
        reasoning: c.reasoning,
      },
      update: {
        similarity: c.similarity,
        sharedQueries: JSON.stringify(c.sharedQueries),
        suggestedAction: c.suggestedAction,
        reasoning: c.reasoning,
      },
    });
  }

  revalidatePath("/admin/content-cannibalization");
  return { flagged: candidates.length };
}

export async function scanAndUpsertCannibalizationPairs(): Promise<StageResult<{ flagged: number }>> {
  try {
    await requirePermission("EDIT");
    const result = await runCannibalizationScan();
    return { success: true, data: result };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error("Content cannibalization scan failed:", error);
    return fail("Scan failed");
  }
}

export async function listCannibalizationPairs() {
  try {
    await requirePermission("EDIT");
    const pairs = await prisma.contentCannibalization.findMany({ where: { status: "OPEN" }, orderBy: [{ similarity: "desc" }] });

    const postIds = [...pairs.flatMap((p) => [p.contentTypeA === "POST" ? p.contentIdA : null, p.contentTypeB === "POST" ? p.contentIdB : null])].filter((id): id is string => !!id);
    const caseIds = [...pairs.flatMap((p) => [p.contentTypeA === "CASE_STUDY" ? p.contentIdA : null, p.contentTypeB === "CASE_STUDY" ? p.contentIdB : null])].filter((id): id is string => !!id);
    const [posts, caseStudies] = await Promise.all([
      prisma.post.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true, slug: true } }),
      prisma.caseStudy.findMany({ where: { id: { in: caseIds } }, select: { id: true, title: true, slug: true } }),
    ]);
    const lookup = new Map([...posts, ...caseStudies].map((c) => [c.id, { title: c.title, slug: c.slug }]));

    return pairs.map((p) => ({ ...p, pageA: lookup.get(p.contentIdA) ?? null, pageB: lookup.get(p.contentIdB) ?? null }));
  } catch (error) {
    console.error("Failed to list content cannibalization pairs:", error);
    return [];
  }
}

export async function dismissCannibalizationPair(id: string): Promise<StageResult<null>> {
  try {
    await requirePermission("EDIT");
    await prisma.contentCannibalization.update({ where: { id }, data: { status: "DISMISSED" } });
    revalidatePath("/admin/content-cannibalization");
    return { success: true, data: null };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to dismiss content cannibalization pair ${id}:`, error);
    return fail("Failed to dismiss");
  }
}

/**
 * Pure bookkeeping — the admin has (or hasn't, their call) already
 * manually merged/redirected/differentiated/retargeted the two pages
 * elsewhere in the admin; this just stops the pair from being
 * re-flagged. The system itself never performs any of those actions.
 */
export async function markCannibalizationResolved(id: string): Promise<StageResult<null>> {
  try {
    await requirePermission("EDIT");
    await prisma.contentCannibalization.update({ where: { id }, data: { status: "RESOLVED" } });
    revalidatePath("/admin/content-cannibalization");
    return { success: true, data: null };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to resolve content cannibalization pair ${id}:`, error);
    return fail("Failed to mark resolved");
  }
}
