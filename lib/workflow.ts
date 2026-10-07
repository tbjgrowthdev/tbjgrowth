import { prisma } from "@/lib/prisma";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import type { Permission } from "@/lib/permissions";
import type { ContentType, PostStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logAudit, type AuditCategory } from "@/lib/audit-log";

const ENTITY_TYPE: Record<ContentType, string> = {
  POST: "Post",
  PAGE: "Page",
  CASE_STUDY: "CaseStudy",
};

const PUBLISHING_ACTIONS = new Set<WorkflowAction>(["schedule", "publish", "unpublish", "archive", "restore"]);

export type WorkflowAction =
  | "submit"
  | "resubmit"
  | "approve"
  | "requestChanges"
  | "reject"
  | "schedule"
  | "publish"
  | "unpublish"
  | "archive"
  | "restore";

type Transition = {
  from: PostStatus[];
  to: PostStatus;
  // Permission required on the CONTENT TYPE'S OWN model action, not a
  // generic site-wide switch — e.g. REVIEW needs CREATE/EDIT on the author's
  // own draft, APPROVE/CHANGES_REQUESTED/REJECT need the reviewer permission.
  permission: Permission;
  requiresComment?: boolean;
};

// Named verbs, not a bare "set status to X" — matches the user's own
// vocabulary (Reject / Request changes / Re-submit) and lets two different
// actions land on the same destination status under different rules (e.g.
// "reject" and an eventual unpublish both end at DRAFT, but only one needs
// APPROVE).
const TRANSITIONS: Record<WorkflowAction, Transition> = {
  submit: { from: ["DRAFT"], to: "REVIEW", permission: "CREATE" },
  resubmit: { from: ["CHANGES_REQUESTED"], to: "REVIEW", permission: "EDIT" },
  approve: { from: ["REVIEW"], to: "APPROVED", permission: "APPROVE" },
  requestChanges: { from: ["REVIEW"], to: "CHANGES_REQUESTED", permission: "APPROVE", requiresComment: true },
  reject: { from: ["REVIEW"], to: "DRAFT", permission: "APPROVE", requiresComment: true },
  schedule: { from: ["DRAFT", "APPROVED"], to: "SCHEDULED", permission: "SCHEDULE" },
  publish: { from: ["DRAFT", "APPROVED", "SCHEDULED"], to: "PUBLISHED", permission: "PUBLISH" },
  unpublish: { from: ["PUBLISHED", "SCHEDULED"], to: "DRAFT", permission: "PUBLISH" },
  archive: { from: ["PUBLISHED", "SCHEDULED", "DRAFT", "APPROVED"], to: "ARCHIVED", permission: "PUBLISH" },
  restore: { from: ["ARCHIVED"], to: "DRAFT", permission: "EDIT" },
};

// Post/Page/CaseStudy each have their own Prisma delegate type with
// incompatible `data` shapes, but the subset this module actually calls
// (findUnique/update by id, returning a record with status/slug/publishedAt)
// is identical across all three — so this narrow shared shape replaces a
// blanket `any` for indexing into whichever one `contentType` picks.
type WorkflowRecord = {
  id: string;
  slug: string;
  status: PostStatus;
  publishedAt: Date | null;
  authorId?: string | null;
  reviewerId?: string | null;
  seoReviewerId?: string | null;
  approverId?: string | null;
  reviewDeadline?: Date | null;
};
type WorkflowDelegate = {
  findUnique(args: { where: { id: string } }): Promise<WorkflowRecord | null>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Prisma.PrismaPromise<WorkflowRecord>;
};

const MODEL: Record<ContentType, WorkflowDelegate> = {
  POST: prisma.post as unknown as WorkflowDelegate,
  PAGE: prisma.page as unknown as WorkflowDelegate,
  CASE_STUDY: prisma.caseStudy as unknown as WorkflowDelegate,
};

const REVALIDATE_PATHS: Record<ContentType, (slug: string, id: string) => string[]> = {
  POST: (slug, id) => ["/admin/posts", `/admin/posts/${id}`, "/blog", `/blog/${slug}`],
  PAGE: (slug, id) => ["/admin/pages", `/admin/pages/${id}`, `/${slug}`],
  CASE_STUDY: (slug, id) => ["/admin/case-studies", `/admin/case-studies/${id}`, "/case-studies", `/case-studies/${slug}`],
};

export async function transitionContent(
  contentType: ContentType,
  id: string,
  action: WorkflowAction,
  comment?: string
) {
  const transition = TRANSITIONS[action];
  if (!transition) {
    return { success: false, error: "Unknown workflow action" };
  }
  if (transition.requiresComment && !comment?.trim()) {
    return { success: false, error: "A comment is required for this action" };
  }

  try {
    const session = await requirePermission(transition.permission);

    const model = MODEL[contentType];
    const current = await model.findUnique({ where: { id } });
    if (!current) {
      return { success: false, error: "Content not found" };
    }

    // Contributors (CREATE/EDIT only, no APPROVE/PUBLISH/SCHEDULE) may only
    // submit/resubmit their own work — anyone with APPROVE/PUBLISH/SCHEDULE
    // can act on anything, since those permissions only exist on roles that
    // manage others' content anyway (see lib/permissions.ts).
    if ((action === "submit" || action === "resubmit") && "authorId" in current) {
      const { hasPermission } = await import("@/lib/permissions");
      const isReviewerRole = hasPermission(session.user.role, "APPROVE");
      if (!isReviewerRole && current.authorId !== session.user.id) {
        return { success: false, error: "You can only submit your own content" };
      }
    }

    if (!transition.from.includes(current.status)) {
      return {
        success: false,
        error: `Cannot ${action} content currently in "${current.status}" status`,
      };
    }

    const updateData: Record<string, unknown> = { status: transition.to };
    if (transition.to === "PUBLISHED" && !current.publishedAt) {
      updateData.publishedAt = new Date();
    }
    // publishedAt is left untouched on unpublish/archive — it records when
    // content last went live, not whether it's live now (status covers that).

    const [updated] = await prisma.$transaction([
      model.update({ where: { id }, data: updateData }),
      prisma.approvalHistory.create({
        data: {
          contentType,
          contentId: id,
          fromStatus: current.status,
          toStatus: transition.to,
          action,
          comment: comment?.trim() || null,
          actorId: session.user.id,
        },
      }),
    ]);

    for (const path of REVALIDATE_PATHS[contentType](updated.slug, id)) {
      revalidatePath(path);
    }

    await logAudit({
      action,
      category: (PUBLISHING_ACTIONS.has(action) ? "Publishing" : "Approval") as AuditCategory,
      entityType: ENTITY_TYPE[contentType],
      entityId: id,
      entityLabel: updated.slug,
      before: { status: current.status },
      after: { status: transition.to },
    });

    return { success: true, data: updated };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Workflow transition "${action}" on ${contentType}:${id} failed:`, error);
    return { success: false, error: "Failed to update content status" };
  }
}

export async function getApprovalHistory(contentType: ContentType, contentId: string) {
  try {
    await requireSession();
    return await prisma.approvalHistory.findMany({
      where: { contentType, contentId },
      include: { actor: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch approval history:", error);
    return [];
  }
}

export type AssignmentRole = "reviewer" | "seoReviewer" | "approver";

const ASSIGNMENT_FIELD: Record<AssignmentRole, string> = {
  reviewer: "reviewerId",
  seoReviewer: "seoReviewerId",
  approver: "approverId",
};

// Assignment is informational routing, not a hard gate — the assigned
// person is who's expected to act, but anyone who already holds APPROVE can
// still act if the assignee is unavailable, same as the rest of this
// workflow. Logged to ApprovalHistory with status unchanged (from === to) so
// it shows up in the same audit timeline as real transitions.
export async function assignUser(
  contentType: ContentType,
  id: string,
  role: AssignmentRole,
  userId: string | null
) {
  try {
    const session = await requirePermission("APPROVE");
    const model = MODEL[contentType];
    const current = await model.findUnique({ where: { id } });
    if (!current) {
      return { success: false, error: "Content not found" };
    }

    const field = ASSIGNMENT_FIELD[role];
    const previousValue = (current as Record<string, unknown>)[field];
    const [updated] = await prisma.$transaction([
      model.update({ where: { id }, data: { [field]: userId } }),
      prisma.approvalHistory.create({
        data: {
          contentType,
          contentId: id,
          fromStatus: current.status,
          toStatus: current.status,
          action: `assign:${role}`,
          comment: userId ? null : `Unassigned ${role}`,
          actorId: session.user.id,
        },
      }),
    ]);

    revalidatePath(`/admin/${contentType === "CASE_STUDY" ? "case-studies" : contentType === "PAGE" ? "pages" : "posts"}/${id}`);

    await logAudit({
      action: `assign:${role}`,
      category: "Approval",
      entityType: ENTITY_TYPE[contentType],
      entityId: id,
      entityLabel: updated.slug,
      before: { [field]: previousValue },
      after: { [field]: userId },
    });

    return { success: true, data: updated };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to assign ${role} on ${contentType}:${id}:`, error);
    return { success: false, error: "Failed to update assignment" };
  }
}

export async function setReviewDeadline(contentType: ContentType, id: string, deadline: string | null) {
  try {
    const session = await requirePermission("APPROVE");
    const model = MODEL[contentType];
    const current = await model.findUnique({ where: { id } });
    if (!current) {
      return { success: false, error: "Content not found" };
    }

    const parsed = deadline ? new Date(deadline) : null;
    const previousDeadline = current.reviewDeadline;
    const [updated] = await prisma.$transaction([
      model.update({ where: { id }, data: { reviewDeadline: parsed } }),
      prisma.approvalHistory.create({
        data: {
          contentType,
          contentId: id,
          fromStatus: current.status,
          toStatus: current.status,
          action: "setDeadline",
          comment: parsed ? `Deadline set to ${parsed.toLocaleDateString()}` : "Deadline cleared",
          actorId: session.user.id,
        },
      }),
    ]);

    await logAudit({
      action: "setDeadline",
      category: "Approval",
      entityType: ENTITY_TYPE[contentType],
      entityId: id,
      entityLabel: updated.slug,
      before: { reviewDeadline: previousDeadline },
      after: { reviewDeadline: parsed },
    });

    return { success: true, data: updated };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to set review deadline on ${contentType}:${id}:`, error);
    return { success: false, error: "Failed to update deadline" };
  }
}

// SEO review is a parallel sign-off, not a state-machine stage — it logs an
// opinion into the same audit trail without moving `status`, so a general
// Editor/Admin approval and an SEO Manager's sign-off can happen in either
// order and both show up in the one history timeline.
export async function recordSeoReview(
  contentType: ContentType,
  id: string,
  approved: boolean,
  comment?: string
) {
  if (!approved && !comment?.trim()) {
    return { success: false, error: "A comment is required when flagging SEO issues" };
  }
  try {
    const session = await requirePermission("SEO_MANAGEMENT");
    const model = MODEL[contentType];
    const current = await model.findUnique({ where: { id } });
    if (!current) {
      return { success: false, error: "Content not found" };
    }

    const action = approved ? "seoApprove" : "seoRequestChanges";
    await prisma.approvalHistory.create({
      data: {
        contentType,
        contentId: id,
        fromStatus: current.status,
        toStatus: current.status,
        action,
        comment: comment?.trim() || null,
        actorId: session.user.id,
      },
    });

    await logAudit({
      action,
      category: "Approval",
      entityType: ENTITY_TYPE[contentType],
      entityId: id,
      entityLabel: current.slug,
      after: { comment: comment?.trim() || null },
    });

    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`SEO review on ${contentType}:${id} failed:`, error);
    return { success: false, error: "Failed to record SEO review" };
  }
}
