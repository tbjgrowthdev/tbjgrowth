"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { transitionContent, type WorkflowAction } from "@/lib/workflow";
import { scheduleContentJob } from "@/app/(admin)/actions/scheduling";
import { logAudit } from "@/lib/audit-log";

const MAX_BULK_SELECTION = 200;

function tooMany(ids: string[]) {
  return ids.length === 0 || ids.length > MAX_BULK_SELECTION;
}

// ------------------------------------------------------
// Status changes (publish / unpublish / archive / restore) — scheduling
// gets its own action below since it needs a date, not just an action name.
// Each post goes through the same transitionContent() single-item workflow
// function used everywhere else (lib/workflow.ts), one at a time: that's
// what keeps a bulk action honoring per-item permission/transition-validity
// rules instead of a raw updateMany bypassing them. Partial success is
// expected and reported per-item, not treated as an all-or-nothing batch —
// e.g. selecting 10 posts where 2 are already ARCHIVED and can't "unpublish"
// should still update the other 8.
const BULK_STATUS_ACTIONS: WorkflowAction[] = ["publish", "unpublish", "archive", "restore"];

export async function bulkChangeStatus(postIds: string[], action: WorkflowAction) {
  if (tooMany(postIds)) return { success: false, error: `Select between 1 and ${MAX_BULK_SELECTION} posts`, results: [] };
  if (!BULK_STATUS_ACTIONS.includes(action)) {
    return { success: false, error: "Unsupported bulk status action", results: [] };
  }

  const results = await Promise.all(
    postIds.map(async (id) => {
      const result = await transitionContent("POST", id, action);
      return { id, success: result.success, error: result.success ? undefined : result.error };
    })
  );

  const succeeded = results.filter((r) => r.success).length;
  if (succeeded > 0) {
    await logAudit({
      action: `bulk-${action}`,
      category: "Publishing",
      entityType: "Post",
      entityLabel: `${succeeded} post${succeeded === 1 ? "" : "s"}`,
      after: { postIds: results.filter((r) => r.success).map((r) => r.id) },
    });
    revalidatePath("/admin/posts");
    revalidatePath("/blog");
  }

  return { success: succeeded > 0, succeeded, failed: results.length - succeeded, results };
}

// ------------------------------------------------------
// Schedule — transitionContent("schedule") moves the status, then
// scheduleContentJob creates the actual ScheduledJob row the cron processor
// acts on later (app/(admin)/actions/scheduling.ts; same pairing the
// single-post scheduling UI already does).
export async function bulkSchedule(postIds: string[], date: string, time: string, timezone: string) {
  if (tooMany(postIds)) return { success: false, error: `Select between 1 and ${MAX_BULK_SELECTION} posts`, results: [] };

  const results = await Promise.all(
    postIds.map(async (id) => {
      const transition = await transitionContent("POST", id, "schedule");
      if (!transition.success) {
        return { id, success: false, error: transition.error };
      }
      const job = await scheduleContentJob("POST", id, "PUBLISH", date, time, timezone);
      if (!job.success) {
        // Best-effort revert — the content shouldn't claim SCHEDULED with no
        // job behind it. If this itself fails, the admin still sees the
        // per-item error and can fix it by hand from the post's own page.
        await transitionContent("POST", id, "unpublish").catch(() => {});
        return { id, success: false, error: job.error };
      }
      return { id, success: true };
    })
  );

  const succeeded = results.filter((r) => r.success).length;
  if (succeeded > 0) {
    await logAudit({
      action: "bulk-schedule",
      category: "Publishing",
      entityType: "Post",
      entityLabel: `${succeeded} post${succeeded === 1 ? "" : "s"}`,
      after: { postIds: results.filter((r) => r.success).map((r) => r.id), date, time, timezone },
    });
    revalidatePath("/admin/posts");
  }

  return { success: succeeded > 0, succeeded, failed: results.length - succeeded, results };
}

// ------------------------------------------------------
// Assign category / tags — additive (connect), never replaces a post's
// existing categories/tags, so running this on an already-tagged batch
// can't accidentally wipe anything. Needs per-post update calls (Prisma's
// updateMany can't do relation connects) — run concurrently via Promise.all,
// same as bulkChangeStatus/bulkSchedule above, not $transaction(): the HTTP
// Neon adapter (lib/prisma.ts) rejects any multi-statement transaction, and
// a connect is idempotent/retry-safe so partial completion on a rare
// mid-batch failure isn't a correctness problem.
export async function bulkAssignCategory(postIds: string[], categoryId: string) {
  if (tooMany(postIds)) return { success: false, error: `Select between 1 and ${MAX_BULK_SELECTION} posts` };
  try {
    await requirePermission("EDIT");
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return { success: false, error: "Category not found" };

    await Promise.all(
      postIds.map((id) => prisma.post.update({ where: { id }, data: { categories: { connect: { id: categoryId } } } }))
    );

    await logAudit({
      action: "bulk-assign-category",
      category: "Content",
      entityType: "Post",
      entityLabel: `${postIds.length} post${postIds.length === 1 ? "" : "s"}`,
      after: { postIds, categoryId, categoryName: category.name },
    });
    revalidatePath("/admin/posts");
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to bulk-assign category:", error);
    return { success: false, error: "Failed to assign category" };
  }
}

export async function bulkAssignTags(postIds: string[], tagIds: string[]) {
  if (tooMany(postIds)) return { success: false, error: `Select between 1 and ${MAX_BULK_SELECTION} posts` };
  if (tagIds.length === 0) return { success: false, error: "Select at least one tag" };
  try {
    await requirePermission("EDIT");

    await Promise.all(
      postIds.map((id) =>
        prisma.post.update({ where: { id }, data: { tags: { connect: tagIds.map((tagId) => ({ id: tagId })) } } })
      )
    );

    await logAudit({
      action: "bulk-assign-tags",
      category: "Content",
      entityType: "Post",
      entityLabel: `${postIds.length} post${postIds.length === 1 ? "" : "s"}`,
      after: { postIds, tagIds },
    });
    revalidatePath("/admin/posts");
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to bulk-assign tags:", error);
    return { success: false, error: "Failed to assign tags" };
  }
}

// ------------------------------------------------------
// Edit metadata — bulk author reassignment. Deliberately the only
// "metadata" field exposed for bulk editing: title/meta-title/meta-
// description/canonical-URL etc. are supposed to be unique per post, so a
// bulk tool that could set them to one identical value for many posts at
// once would be a duplicate-content footgun, not a convenience. Author
// reassignment has no such problem (it's expected to be shared).
export async function bulkReassignAuthor(postIds: string[], authorId: string) {
  if (tooMany(postIds)) return { success: false, error: `Select between 1 and ${MAX_BULK_SELECTION} posts` };
  try {
    await requirePermission("EDIT");
    const author = await prisma.user.findUnique({ where: { id: authorId } });
    if (!author) return { success: false, error: "User not found" };

    // Not updateMany() — the HTTP-based Neon adapter (lib/prisma.ts) rejects
    // it the same way it rejects createMany/multi-op $transaction arrays.
    await Promise.all(postIds.map((id) => prisma.post.update({ where: { id }, data: { authorId } })));

    await logAudit({
      action: "bulk-reassign-author",
      category: "Content",
      entityType: "Post",
      entityLabel: `${postIds.length} post${postIds.length === 1 ? "" : "s"}`,
      after: { postIds, authorId, authorName: author.name },
    });
    revalidatePath("/admin/posts");
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to bulk-reassign author:", error);
    return { success: false, error: "Failed to reassign author" };
  }
}

// ------------------------------------------------------
// SEO updates — only the two fields that are safe to set to the same value
// across many posts at once (see bulkReassignAuthor's comment on why
// per-post-unique SEO text fields aren't offered here). `undefined` for
// either parameter means "leave as-is" for that field.
export async function bulkUpdateSeo(postIds: string[], data: { isIndexable?: boolean; twitterCard?: string }) {
  if (tooMany(postIds)) return { success: false, error: `Select between 1 and ${MAX_BULK_SELECTION} posts` };
  if (data.isIndexable === undefined && !data.twitterCard) {
    return { success: false, error: "Nothing to update" };
  }
  try {
    await requirePermission("EDIT");

    const updateData: Record<string, unknown> = {};
    if (data.isIndexable !== undefined) updateData.isIndexable = data.isIndexable;
    if (data.twitterCard) updateData.twitterCard = data.twitterCard;

    // Not updateMany() — see bulkReassignAuthor's comment above.
    await Promise.all(postIds.map((id) => prisma.post.update({ where: { id }, data: updateData })));

    await logAudit({
      action: "bulk-update-seo",
      category: "SEO",
      entityType: "Post",
      entityLabel: `${postIds.length} post${postIds.length === 1 ? "" : "s"}`,
      after: { postIds, ...updateData },
    });
    revalidatePath("/admin/posts");
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to bulk-update SEO:", error);
    return { success: false, error: "Failed to update SEO settings" };
  }
}
