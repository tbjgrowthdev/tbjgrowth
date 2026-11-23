// Client push devices and notification settings, scoped to a ClientContext.
// Pages and actions under /portal never touch Prisma directly; this is the
// push part of the portal data layer (see lib/portal/data.ts).
import prisma from "@/lib/prisma";
import type { ClientContext } from "@/lib/portal/auth";

/** The events a client can turn on and off (CLIENT_INVOICE_OVERDUE follows CLIENT_INVOICE_DUE). */
export const CLIENT_PUSH_EVENTS = ["CLIENT_PROJECT_UPDATE", "CLIENT_APPROVAL_NEEDED", "CLIENT_REPORT_READY", "CLIENT_INVOICE_DUE", "CLIENT_MEETING_REMINDER"] as const;
export type ClientPushEventName = (typeof CLIENT_PUSH_EVENTS)[number];

/**
 * Registers (or takes over) a device token for this client user. A phone that
 * was signed in to TBJ Admin before drops that owner: the PushDevice_one_owner
 * CHECK allows exactly one of userId / clientUserId.
 */
export async function registerClientDevice(ctx: ClientContext, token: string, platform: "android" | "web", now: Date = new Date()): Promise<void> {
  const existing = await prisma.pushDevice.findUnique({ where: { token }, select: { id: true } });
  if (existing) {
    await prisma.pushDevice.update({ where: { id: existing.id }, data: { platform, clientUserId: ctx.clientUserId, userId: null, adminSessionId: null, lastSeenAt: now } });
    return;
  }
  try {
    await prisma.pushDevice.create({ data: { token, platform, clientUserId: ctx.clientUserId, userId: null, adminSessionId: null, lastSeenAt: now } });
  } catch (error) {
    // Registered by a parallel request a moment ago: take it over.
    if ((error as { code?: string })?.code !== "P2002") throw error;
    await prisma.pushDevice.update({ where: { token }, data: { platform, clientUserId: ctx.clientUserId, userId: null, adminSessionId: null, lastSeenAt: now } });
  }
}

/** Removes the token only if it belongs to this client user. */
export async function unregisterClientDevice(ctx: ClientContext, token: string): Promise<void> {
  await prisma.pushDevice.deleteMany({ where: { token, clientUserId: ctx.clientUserId } });
}

export async function clientPushPreferences(ctx: ClientContext): Promise<Array<{ event: ClientPushEventName; enabled: boolean }>> {
  const rows = await prisma.clientPushPreference.findMany({ where: { clientUserId: ctx.clientUserId }, select: { event: true, enabled: true } });
  const byEvent = new Map(rows.map((r) => [r.event as string, r.enabled]));
  return CLIENT_PUSH_EVENTS.map((event) => ({ event, enabled: byEvent.get(event) ?? true }));
}

/**
 * One row per (user, event). Delete then create (no upsert on a composite key
 * needed; Neon HTTP runs each as one statement). A parallel save that loses
 * the race hits P2002 and is ignored: the same user just saved the same event.
 * The overdue event follows the due one.
 */
export async function saveClientPushPreference(ctx: ClientContext, event: ClientPushEventName, enabled: boolean): Promise<void> {
  const events = event === "CLIENT_INVOICE_DUE" ? (["CLIENT_INVOICE_DUE", "CLIENT_INVOICE_OVERDUE"] as const) : ([event] as const);
  for (const e of events) {
    await prisma.clientPushPreference.deleteMany({ where: { clientUserId: ctx.clientUserId, event: e } });
    try {
      await prisma.clientPushPreference.create({ data: { clientUserId: ctx.clientUserId, event: e, enabled } });
    } catch (error) {
      if ((error as { code?: string })?.code !== "P2002") throw error;
    }
  }
}
