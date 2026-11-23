"use server";

import { revalidatePath } from "next/cache";
import { requireClient, ClientAuthError } from "@/lib/portal/auth";
import { requestAccountDeletion as recordDeletion, setLanguage as saveLanguage, staffContactFor } from "@/lib/portal/data";
import { sendAccountDeletionRequestNotification } from "@/lib/email";
import { logAudit } from "@/lib/audit-log";
import { now } from "@/lib/clients/clock";

// The signed-in client's own settings on /portal/more.

type Simple = { success: true } | { success: false; error: "signed_out" | "invalid" | "failed" };

function fail(error: unknown, label: string): Simple {
  if (error instanceof ClientAuthError) return { success: false, error: "signed_out" };
  console.error(`[portal] ${label} failed:`, error);
  return { success: false, error: "failed" };
}

export async function setLanguage(input: { language: "en" | "bn" }): Promise<Simple> {
  try {
    const ctx = await requireClient();
    if (!(await saveLanguage(ctx, input?.language))) return { success: false, error: "invalid" };
    revalidatePath("/portal", "layout");
    return { success: true };
  } catch (error) {
    return fail(error, "setLanguage");
  }
}

/** Records the request and tells staff (once). Deleting the account is a manual staff step in v1. */
export async function requestAccountDeletion(): Promise<Simple> {
  try {
    const ctx = await requireClient();
    const result = await recordDeletion(ctx, now());
    if (!result.ok) return { success: false, error: "failed" };
    if (result.first) {
      const contact = await staffContactFor(ctx);
      try {
        if (contact) await sendAccountDeletionRequestNotification(contact);
      } catch (error) {
        console.error("[portal] deletion request email failed:", error);
      }
      await logAudit({
        action: "request_deletion",
        category: "Users",
        entityType: "ClientUser",
        entityId: ctx.clientUserId,
        entityLabel: contact?.userEmail ?? null,
        actor: { name: contact ? `${contact.userName} (client)` : "Client", email: contact?.userEmail ?? null },
      });
    }
    revalidatePath("/portal/more");
    return { success: true };
  } catch (error) {
    return fail(error, "requestAccountDeletion");
  }
}
