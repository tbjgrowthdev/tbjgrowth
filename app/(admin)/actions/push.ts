"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, AuthError } from "@/lib/auth-guard";
import { eligibleEvents, isPushEnabled, isStaffPushEvent } from "@/lib/push/recipients";
import type { PushEvent } from "@/lib/generated/prisma/client";

// Push notification device registration (called by the TBJ Admin Android
// app through components/Admin/NativeAppBridge.tsx) and per-user
// notification preferences (Profile → Notifications).

const registerSchema = z.object({
  // FCM registration tokens are ~150-200 chars; 4096 is a generous cap.
  token: z.string().trim().min(1).max(4096),
  platform: z.enum(["android", "web"]),
});

function failure(error: unknown, fallback: string) {
  if (error instanceof AuthError) return { success: false as const, error: error.message };
  console.error(`${fallback}:`, error);
  return { success: false as const, error: fallback };
}

export async function registerPushDevice(data: { token: string; platform: "android" | "web" }) {
  try {
    const session = await requireSession();
    const parsed = registerSchema.safeParse(data);
    if (!parsed.success) return { success: false as const, error: "Invalid device registration" };
    const { token, platform } = parsed.data;
    const now = new Date();
    // Upsert by token: a phone that signs in as someone else moves to them,
    // so the previous user stops getting its notifications.
    await prisma.pushDevice.upsert({
      where: { token },
      create: { token, platform, userId: session.user.id, adminSessionId: session.user.sessionId ?? null, lastSeenAt: now },
      // clientUserId: null — a token moving from the client app to TBJ Admin must
      // drop its client owner (the PushDevice_one_owner CHECK allows one owner).
      update: { platform, userId: session.user.id, adminSessionId: session.user.sessionId ?? null, clientUserId: null, lastSeenAt: now },
    });
    return { success: true as const };
  } catch (error) {
    return failure(error, "Failed to register device for notifications");
  }
}

export async function unregisterPushDevice(token: string) {
  try {
    const session = await requireSession();
    if (typeof token !== "string" || !token) return { success: false as const, error: "Invalid token" };
    await prisma.pushDevice.deleteMany({ where: { token, userId: session.user.id } });
    return { success: true as const };
  } catch (error) {
    return failure(error, "Failed to unregister device");
  }
}

export async function getPushPreferences() {
  try {
    const session = await requireSession();
    const rows = await prisma.pushPreference.findMany({ where: { userId: session.user.id } });
    const byEvent = new Map(rows.map((r) => [r.event, r.enabled]));
    const preferences = eligibleEvents(session.user.role).map((event) => ({
      event,
      enabled: isPushEnabled(session.user.role, event, byEvent.get(event)),
    }));
    return { success: true as const, preferences };
  } catch (error) {
    return { ...failure(error, "Failed to load notification settings"), preferences: [] };
  }
}

export async function setPushPreference(event: PushEvent, enabled: boolean) {
  try {
    const session = await requireSession();
    if (!isStaffPushEvent(event) || typeof enabled !== "boolean") {
      return { success: false as const, error: "Invalid notification setting" };
    }
    if (!eligibleEvents(session.user.role).includes(event)) {
      return { success: false as const, error: "Your role can't receive this notification" };
    }
    await prisma.pushPreference.upsert({
      where: { userId_event: { userId: session.user.id, event } },
      create: { userId: session.user.id, event, enabled },
      update: { enabled },
    });
    return { success: true as const };
  } catch (error) {
    return failure(error, "Failed to save notification setting");
  }
}
