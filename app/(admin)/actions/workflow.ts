"use server";

import { getApprovalHistory, assignUser, setReviewDeadline, recordSeoReview, type AssignmentRole } from "@/lib/workflow";
import type { ContentType } from "@/lib/generated/prisma/client";
import { guardMutation, guardRead } from "@/lib/action-guard";

export async function getContentApprovalHistory(contentType: ContentType, contentId: string) {
  return guardRead("SESSION", () => [], () => getApprovalHistory(contentType, contentId));
}

export async function assignContentUser(contentType: ContentType, id: string, role: AssignmentRole, userId: string | null) {
  return guardMutation("APPROVE", () => assignUser(contentType, id, role, userId));
}

export async function setContentReviewDeadline(contentType: ContentType, id: string, deadline: string | null) {
  return guardMutation("APPROVE", () => setReviewDeadline(contentType, id, deadline));
}

export async function submitSeoReview(contentType: ContentType, id: string, approved: boolean, comment?: string) {
  return guardMutation("SEO_MANAGEMENT", () => recordSeoReview(contentType, id, approved, comment));
}
