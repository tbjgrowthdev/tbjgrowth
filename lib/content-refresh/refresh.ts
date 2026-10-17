import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit-log";
import { callAiForJson } from "@/lib/content-pipeline/ai";
import { completeJob, createRefreshJob, failJob } from "@/lib/content-pipeline/jobs";
import { getContentRecord, patchContent } from "@/lib/content-pipeline/content-helpers";
import type { PipelineContentType } from "@/lib/content-pipeline/types";
import { retrieveApprovedSources } from "@/lib/rag/retrieve";
import { scanForRefreshCandidates } from "./detect";
import { buildRefreshPrompt } from "./prompts";
import type { DetectedSignal } from "./types";

type StageResult<T> = { success: true; data: T } | { success: false; error: string };

function fail(error: string): StageResult<never> {
  return { success: false, error };
}

const ACTIVE_STATUSES = ["DETECTED", "DRAFTING", "DRAFTED", "APPROVED"] as const;

/**
 * The actual scan+persist logic, with no auth check — callable from a
 * cron context (app/api/cron/content-refresh-scan) where there's no
 * session at all, same reason lib/link-monitor.ts's runLinkCheck has none
 * either. `createdById` is null for a scheduled run (see the matching
 * schema comment); scanAndUpsertCandidates() below is the real entry
 * point for a human clicking "Scan Now" and is the one that checks
 * permission.
 *
 * An existing ACTIVE cycle (not yet applied or rejected) for the same
 * content gets its signals refreshed in place rather than duplicated;
 * content with no active cycle and at least one signal gets a brand new
 * DETECTED row. A cycle that was already APPLIED or REJECTED is left
 * alone — if the content still has signals after that, the next scan
 * starts a genuinely new cycle rather than reopening the old one.
 */
export async function runRefreshScan(createdById: string | null): Promise<{ flagged: number }> {
  const candidates = await scanForRefreshCandidates();

  for (const candidate of candidates) {
    const existing = await prisma.contentRefresh.findFirst({
      where: { contentType: candidate.contentType, contentId: candidate.contentId, status: { in: [...ACTIVE_STATUSES] } },
    });
    if (existing) {
      await prisma.contentRefresh.update({ where: { id: existing.id }, data: { signals: JSON.stringify(candidate.signals) } });
    } else {
      await prisma.contentRefresh.create({
        data: {
          contentType: candidate.contentType,
          contentId: candidate.contentId,
          signals: JSON.stringify(candidate.signals),
          status: "DETECTED",
          createdById,
        },
      });
    }
  }

  revalidatePath("/admin/content-refresh");
  return { flagged: candidates.length };
}

export async function scanAndUpsertCandidates(): Promise<StageResult<{ flagged: number }>> {
  try {
    const session = await requirePermission("EDIT");
    const result = await runRefreshScan(session.user.id);
    return { success: true, data: result };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error("Content refresh scan failed:", error);
    return fail("Scan failed");
  }
}

export async function listRefreshCandidates() {
  try {
    await requirePermission("EDIT");
    const refreshes = await prisma.contentRefresh.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
    const postIds = refreshes.filter((r) => r.contentType === "POST").map((r) => r.contentId);
    const caseIds = refreshes.filter((r) => r.contentType === "CASE_STUDY").map((r) => r.contentId);
    const [posts, caseStudies] = await Promise.all([
      prisma.post.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true, slug: true } }),
      prisma.caseStudy.findMany({ where: { id: { in: caseIds } }, select: { id: true, title: true, slug: true } }),
    ]);
    const titles = new Map([...posts, ...caseStudies].map((c) => [c.id, { title: c.title, slug: c.slug }]));

    return refreshes.map((r) => ({ ...r, content: titles.get(r.contentId) ?? null }));
  } catch (error) {
    console.error("Failed to list content refresh candidates:", error);
    return [];
  }
}

export async function getRefreshDetail(id: string) {
  try {
    await requirePermission("EDIT");
    const refresh = await prisma.contentRefresh.findUnique({ where: { id } });
    if (!refresh) return null;
    const content = await getContentRecord(refresh.contentType as PipelineContentType, refresh.contentId);
    return { refresh, content };
  } catch (error) {
    console.error(`Failed to load content refresh ${id}:`, error);
    return null;
  }
}

const DRAFTABLE_STATUSES = ["DETECTED", "DRAFTING", "DRAFTED", "REJECTED"] as const;

/**
 * Generates (or regenerates) a proposed revision — never writes to the
 * real Post/CaseStudy row. Always a fresh job (see createRefreshJob's own
 * comment), so calling this again after a DRAFTED or REJECTED result is a
 * deliberate "try again," not an accidental re-run.
 */
export async function generateRefreshDraft(id: string): Promise<StageResult<null>> {
  try {
    await requirePermission("EDIT");
    const refresh = await prisma.contentRefresh.findUnique({ where: { id } });
    if (!refresh) return fail("Refresh not found");
    if (!DRAFTABLE_STATUSES.includes(refresh.status as (typeof DRAFTABLE_STATUSES)[number])) {
      return fail(`Cannot draft from status ${refresh.status}`);
    }

    const content = await getContentRecord(refresh.contentType as PipelineContentType, refresh.contentId);
    if (!content) return fail("The content being refreshed no longer exists");

    await prisma.contentRefresh.update({ where: { id }, data: { status: "DRAFTING" } });
    const job = await createRefreshJob(id, refresh.contentId);

    try {
      const signals = JSON.parse(refresh.signals) as DetectedSignal[];
      const retrievedSources = await retrieveApprovedSources(content.title);
      const prompt = await buildRefreshPrompt({ title: content.title, contentHtml: content.content, signals, retrievedSources });
      const { data: draft, usage } = await callAiForJson<{
        title: string;
        contentHtml: string;
        excerpt: string;
        metaTitle: string;
        metaDescription: string;
        changeSummary: string;
      }>(prompt.system, prompt.user, 8192);

      await prisma.contentRefresh.update({
        where: { id },
        data: {
          status: "DRAFTED",
          draftTitle: draft.title,
          draftContent: draft.contentHtml,
          draftExcerpt: draft.excerpt,
          draftMetaTitle: draft.metaTitle,
          draftMetaDescription: draft.metaDescription,
          changeSummary: draft.changeSummary,
        },
      });
      await completeJob(job.id, { usage });
      revalidatePath(`/admin/content-refresh/${id}`);
      return { success: true, data: null };
    } catch (stageError: any) {
      await failJob(job.id, stageError?.message || String(stageError), stageError?.usage);
      await prisma.contentRefresh.update({ where: { id }, data: { status: "DETECTED" } });
      throw stageError;
    }
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to draft content refresh ${id}:`, error);
    return fail(error.message || "Failed to generate refresh draft");
  }
}

/** Mandatory human approval, same principle as the main pipeline — requires APPROVE, not just EDIT, so the approver is never required to be whoever ran the scan/drafted it. */
export async function approveRefreshDraft(id: string): Promise<StageResult<null>> {
  try {
    const session = await requirePermission("APPROVE");
    const refresh = await prisma.contentRefresh.findUnique({ where: { id } });
    if (!refresh) return fail("Refresh not found");
    if (refresh.status !== "DRAFTED") return fail(`Expected status DRAFTED, this is ${refresh.status}`);

    await prisma.contentRefresh.update({ where: { id }, data: { status: "APPROVED", approvedById: session.user.id, approvedAt: new Date() } });
    await logAudit({ action: "approve", category: "Content", entityType: "ContentRefresh", entityId: id, entityLabel: refresh.draftTitle ?? refresh.contentId });
    revalidatePath(`/admin/content-refresh/${id}`);
    return { success: true, data: null };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to approve content refresh ${id}:`, error);
    return fail("Failed to approve refresh draft");
  }
}

export async function rejectRefreshDraft(id: string): Promise<StageResult<null>> {
  try {
    await requirePermission("EDIT");
    const refresh = await prisma.contentRefresh.findUnique({ where: { id } });
    if (!refresh) return fail("Refresh not found");
    if (refresh.status !== "DRAFTED") return fail(`Expected status DRAFTED, this is ${refresh.status}`);

    await prisma.contentRefresh.update({ where: { id }, data: { status: "REJECTED" } });
    revalidatePath(`/admin/content-refresh/${id}`);
    return { success: true, data: null };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to reject content refresh ${id}:`, error);
    return fail("Failed to reject refresh draft");
  }
}

/**
 * The only place a refresh ever touches the live Post/CaseStudy row —
 * everything before this is staged on the ContentRefresh row itself.
 * Requires PUBLISH, not just APPROVE/EDIT: this directly rewrites
 * already-published content, so it's gated at least as strictly as
 * publishing a brand-new piece. Goes through the normal updatePost/
 * updateCaseStudy actions (via patchContent), which call recordVersion
 * themselves — so the pre-refresh content is preserved in that content's
 * own version history and can be restored from there if the refresh
 * turns out wrong, exactly like any other edit.
 */
export async function applyRefreshDraft(id: string): Promise<StageResult<null>> {
  try {
    await requirePermission("PUBLISH");
    const refresh = await prisma.contentRefresh.findUnique({ where: { id } });
    if (!refresh) return fail("Refresh not found");
    if (refresh.status !== "APPROVED") return fail(`Expected status APPROVED, this is ${refresh.status}`);
    if (!refresh.draftContent) return fail("No draft content to apply");

    const patchResult = await patchContent(refresh.contentType as PipelineContentType, refresh.contentId, {
      title: refresh.draftTitle || undefined,
      content: refresh.draftContent,
      excerpt: refresh.draftExcerpt || undefined,
      metaTitle: refresh.draftMetaTitle || undefined,
      metaDescription: refresh.draftMetaDescription || undefined,
      changeSummary: refresh.changeSummary ? `Content Refresh: ${refresh.changeSummary}` : "Content Refresh",
    });
    if (!patchResult.success) return fail(patchResult.error || "Failed to apply the refresh");

    await prisma.contentRefresh.update({ where: { id }, data: { status: "APPLIED", appliedAt: new Date() } });
    await logAudit({ action: "update", category: "Content", entityType: "ContentRefresh", entityId: id, entityLabel: refresh.draftTitle ?? refresh.contentId, after: { applied: true } });
    // patchContent already revalidated the content's own admin/public paths
    // (it goes through the normal updatePost/updateCaseStudy actions).
    revalidatePath(`/admin/content-refresh/${id}`);
    return { success: true, data: null };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to apply content refresh ${id}:`, error);
    return fail("Failed to apply refresh");
  }
}
