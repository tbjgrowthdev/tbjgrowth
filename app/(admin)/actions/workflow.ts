"use server";

import { getApprovalHistory, assignUser, setReviewDeadline, recordSeoReview, type AssignmentRole } from "@/lib/workflow";
import type { ContentType } from "@prisma/client";

export async function getContentApprovalHistory(contentType: ContentType, contentId: string) {
  return getApprovalHistory(contentType, contentId);
}

export async function assignContentUser(contentType: ContentType, id: string, role: AssignmentRole, userId: string | null) {
  return assignUser(contentType, id, role, userId);
}

export async function setContentReviewDeadline(contentType: ContentType, id: string, deadline: string | null) {
  return setReviewDeadline(contentType, id, deadline);
}

export async function submitSeoReview(contentType: ContentType, id: string, approved: boolean, comment?: string) {
  return recordSeoReview(contentType, id, approved, comment);
}
