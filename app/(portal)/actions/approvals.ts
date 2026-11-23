"use server";

import { revalidatePath } from "next/cache";
import { requireClient, ClientAuthError } from "@/lib/portal/auth";
import { respondToApproval as recordAnswer, getProfile } from "@/lib/portal/data";
import { logAudit } from "@/lib/audit-log";
import { now } from "@/lib/clients/clock";

// The client approves, or asks for changes on, one of their own pending
// approval requests (Home "Waiting on you", project page). Scoping, the
// one-answer rule and the decision check live in lib/portal/data.ts.

export type RespondInput = { approvalId: string; decision: "APPROVED" | "CHANGES_REQUESTED"; comment?: string | null };
type RespondResponse = { success: true } | { success: false; error: "signed_out" | "not_found" | "already_answered" | "invalid_decision" | "comment_required" | "failed" };

export async function respondToApproval(input: RespondInput): Promise<RespondResponse> {
  try {
    const ctx = await requireClient();
    const result = await recordAnswer(ctx, input?.approvalId, { decision: input?.decision, comment: input?.comment }, now());
    if (!result.ok) return { success: false, error: result.reason };
    const profile = await getProfile(ctx);
    await logAudit({
      action: input.decision === "APPROVED" ? "approve" : "request_changes",
      category: "Approval",
      entityType: "ApprovalRequest",
      entityId: input.approvalId,
      entityLabel: result.title,
      after: { decision: input.decision, clientUserId: ctx.clientUserId, clientId: ctx.clientId },
      actor: { name: profile ? `${profile.name} (client)` : "Client", email: profile?.email ?? null },
    });
    revalidatePath("/portal");
    revalidatePath(`/portal/projects/${result.projectId}`);
    return { success: true };
  } catch (error) {
    if (error instanceof ClientAuthError) return { success: false, error: "signed_out" };
    console.error("[portal] respondToApproval failed:", error);
    return { success: false, error: "failed" };
  }
}
