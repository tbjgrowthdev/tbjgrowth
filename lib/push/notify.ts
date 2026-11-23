import { after } from "next/server";
import prisma from "@/lib/prisma";
import { recipientTokens, staffUserTokens, type StaffPushEvent } from "@/lib/push/recipients";
import { sendFcm } from "@/lib/push/fcm";
import { PUSH_MESSAGES, type PushMessage } from "@/lib/push/messages";

/**
 * Sends `event`'s push to everyone who should get it. Never throws: a push
 * problem must never fail the form, booking or workflow action that caused
 * it. Tokens FCM reports as dead are deleted.
 *
 * `url` overrides the default admin page the notification opens (e.g. the
 * exact post that was submitted). It must be an /admin path with no PII.
 */
export async function notifyAdmins(event: StaffPushEvent, opts: { url?: string } = {}): Promise<void> {
  try {
    const tokens = await recipientTokens(event);
    if (tokens.length === 0) return;
    const message = { ...PUSH_MESSAGES[event], ...(opts.url ? { url: opts.url } : {}) };
    const { invalidTokens } = await sendFcm(tokens, message);
    if (invalidTokens.length > 0) {
      await prisma.pushDevice.deleteMany({ where: { token: { in: invalidTokens } } });
    }
  } catch (error) {
    console.error(`Push notification "${event}" failed:`, error);
  }
}

/**
 * Schedules notifyAdmins to run after the response is sent (Next's after(),
 * which the Cloudflare adapter maps to waitUntil), so a visitor never waits
 * on FCM.
 */
export function scheduleAdminPush(event: StaffPushEvent, opts: { url?: string } = {}): void {
  try {
    after(() => notifyAdmins(event, opts));
  } catch (error) {
    // Outside a request scope (scripts, cron): just run it.
    console.warn("after() unavailable, sending push inline:", error);
    void notifyAdmins(event, opts);
  }
}

/** Push to one staff member's devices (e.g. the stale-project nudge). Never throws. `message.url` must be an /admin path with no PII. */
export async function notifyStaffUser(userId: string, message: PushMessage): Promise<void> {
  try {
    const tokens = await staffUserTokens(userId);
    if (tokens.length === 0) return;
    const { invalidTokens } = await sendFcm(tokens, message);
    if (invalidTokens.length > 0) await prisma.pushDevice.deleteMany({ where: { token: { in: invalidTokens } } });
  } catch (error) {
    console.error("Staff push failed:", error);
  }
}
