import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { detectOrphanAndWeakPages } from "./detect";
import type { LinkSuggestion } from "./types";

type StageResult<T> = { success: true; data: T } | { success: false; error: string };

function fail(error: string): StageResult<never> {
  return { success: false, error };
}

const ACTIONED_STATUSES = ["RESOLVED", "DISMISSED"] as const;

/**
 * The actual scan+persist logic, with no auth check — callable from a cron
 * context (app/api/cron/orphan-pages-scan), same pattern as
 * lib/content-cannibalization/cannibalization.ts's runCannibalizationScan.
 * A page already RESOLVED or DISMISSED is left untouched; this system
 * never changes that status itself — only a human clicking Resolve/Dismiss
 * does, after they've added a link (or decided it's not worth it)
 * elsewhere in the admin.
 */
export async function runOrphanPageScan(): Promise<{ flagged: number }> {
  const candidates = await detectOrphanAndWeakPages();

  for (const c of candidates) {
    const existing = await prisma.orphanPage.findUnique({ where: { contentId: c.contentId } });
    if (existing && ACTIONED_STATUSES.includes(existing.status as (typeof ACTIONED_STATUSES)[number])) continue;

    await prisma.orphanPage.upsert({
      where: { contentId: c.contentId },
      create: {
        contentType: c.contentType,
        contentId: c.contentId,
        inboundLinkCount: c.inboundLinkCount,
        suggestions: JSON.stringify(c.suggestions),
      },
      update: {
        inboundLinkCount: c.inboundLinkCount,
        suggestions: JSON.stringify(c.suggestions),
      },
    });
  }

  revalidatePath("/admin/orphan-pages");
  return { flagged: candidates.length };
}

export async function scanAndUpsertOrphanPages(): Promise<StageResult<{ flagged: number }>> {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const result = await runOrphanPageScan();
    return { success: true, data: result };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error("Orphan page scan failed:", error);
    return fail("Scan failed");
  }
}

export async function listOrphanPages() {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const rows = await prisma.orphanPage.findMany({
      where: { status: "OPEN" },
      orderBy: [{ inboundLinkCount: "asc" }, { updatedAt: "desc" }],
    });

    const postIds = rows.filter((r) => r.contentType === "POST").map((r) => r.contentId);
    const caseIds = rows.filter((r) => r.contentType === "CASE_STUDY").map((r) => r.contentId);
    const [posts, caseStudies] = await Promise.all([
      prisma.post.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true, slug: true } }),
      prisma.caseStudy.findMany({ where: { id: { in: caseIds } }, select: { id: true, title: true, slug: true } }),
    ]);
    const lookup = new Map([...posts, ...caseStudies].map((c) => [c.id, { title: c.title, slug: c.slug }]));

    return rows.map((r) => ({
      ...r,
      page: lookup.get(r.contentId) ?? null,
      suggestions: JSON.parse(r.suggestions) as LinkSuggestion[],
    }));
  } catch (error) {
    console.error("Failed to list orphan pages:", error);
    return [];
  }
}

export async function dismissOrphanPage(id: string): Promise<StageResult<null>> {
  try {
    await requirePermission("SEO_MANAGEMENT");
    await prisma.orphanPage.update({ where: { id }, data: { status: "DISMISSED" } });
    revalidatePath("/admin/orphan-pages");
    return { success: true, data: null };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to dismiss orphan page ${id}:`, error);
    return fail("Failed to dismiss");
  }
}

/** Pure bookkeeping — the admin has (or hasn't) already manually added a link somewhere; this just stops the page from being re-flagged. The system itself never edits content to add a link. */
export async function markOrphanPageResolved(id: string): Promise<StageResult<null>> {
  try {
    await requirePermission("SEO_MANAGEMENT");
    await prisma.orphanPage.update({ where: { id }, data: { status: "RESOLVED" } });
    revalidatePath("/admin/orphan-pages");
    return { success: true, data: null };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to resolve orphan page ${id}:`, error);
    return fail("Failed to mark resolved");
  }
}
