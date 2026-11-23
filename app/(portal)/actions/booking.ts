"use server";

import { revalidatePath } from "next/cache";
import { requireClient, ClientAuthError } from "@/lib/portal/auth";
import { bookCall as book, bookingNotifyEmail } from "@/lib/portal/data";
import { sendBookingNotification } from "@/lib/email";
import { scheduleAdminPush } from "@/lib/push/notify";
import { now } from "@/lib/clients/clock";

// Book a call from /portal/more: reuses the public slots (AvailableSlot) and
// Booking, linked to the client user and prefilled from their account.

type BookResponse = { success: true; startsAt: string } | { success: false; error: "signed_out" | "taken" | "failed" };

export async function bookCall(input: { slotId: string; message?: string | null }): Promise<BookResponse> {
  try {
    const ctx = await requireClient();
    const result = await book(ctx, input?.slotId, { message: input?.message }, now());
    if (!result.ok) return { success: false, error: "taken" };
    // Same staff notifications as a public booking.
    try {
      await sendBookingNotification(
        { name: result.name, email: result.email, company: result.company, message: input?.message?.trim() || null, startsAt: result.startsAt, duration: result.duration },
        await bookingNotifyEmail(ctx)
      );
    } catch (error) {
      console.error("[portal] booking email failed:", error);
    }
    scheduleAdminPush("NEW_BOOKING");
    revalidatePath("/portal/more");
    revalidatePath("/portal");
    return { success: true, startsAt: result.startsAt.toISOString() };
  } catch (error) {
    if (error instanceof ClientAuthError) return { success: false, error: "signed_out" };
    console.error("[portal] bookCall failed:", error);
    return { success: false, error: "failed" };
  }
}
