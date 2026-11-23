"use server";

import { revalidatePath } from "next/cache";
import { requireClient, ClientAuthError } from "@/lib/portal/auth";
import { createClientRequest, staffContactFor } from "@/lib/portal/data";
import { sendClientRequestNotification } from "@/lib/email";

// "Send a request" on /portal/more: stored as a ClientRequest for the
// session's client (staff inbox /admin/clients/requests) and emailed to the
// account manager (or the site's notification email).

type RequestResponse = { success: true } | { success: false; error: "signed_out" | "empty" | "too_long" | "failed" };

export async function sendRequest(input: { message: string }): Promise<RequestResponse> {
  try {
    const ctx = await requireClient();
    const result = await createClientRequest(ctx, input?.message);
    if (!result.ok) return { success: false, error: result.reason };
    try {
      const contact = await staffContactFor(ctx);
      if (contact) await sendClientRequestNotification({ ...contact, message: input.message.trim() });
    } catch (error) {
      console.error("[portal] request email failed:", error);
    }
    revalidatePath("/portal/more");
    return { success: true };
  } catch (error) {
    if (error instanceof ClientAuthError) return { success: false, error: "signed_out" };
    console.error("[portal] sendRequest failed:", error);
    return { success: false, error: "failed" };
  }
}
