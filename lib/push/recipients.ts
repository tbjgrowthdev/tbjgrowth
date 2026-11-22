import prisma from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { PushEvent, Role } from "@/lib/generated/prisma/client";

// Who may get which push, and who gets it unless they turn it off.
//
// Eligibility follows the permission that already guards the page the push
// opens, so a push never points someone at a page they can't load:
//   NEW_LEAD                  -> /admin/leads (USER_MANAGEMENT, leads hold client PII)
//   NEW_BOOKING               -> /admin/booking (every role middleware.ts lets in: not SEO_MANAGER)
//   CONTENT_AWAITING_APPROVAL -> /admin/posts review (APPROVE)
// Default on for SUPER_ADMIN, ADMIN, EDITOR; off for SEO_MANAGER and
// CONTRIBUTOR (spec §9ক). A PushPreference row overrides the default.

// Staff (TBJ Admin) events. The CLIENT_* values of PushEvent go to client users
// only (lib/push/client-notify.ts) and never through these functions.
export type StaffPushEvent = Extract<PushEvent, "NEW_LEAD" | "NEW_BOOKING" | "CONTENT_AWAITING_APPROVAL">;
export const PUSH_EVENTS: StaffPushEvent[] = ["NEW_LEAD", "NEW_BOOKING", "CONTENT_AWAITING_APPROVAL"];

export function isStaffPushEvent(event: unknown): event is StaffPushEvent {
  return (PUSH_EVENTS as unknown[]).includes(event);
}

const DEFAULT_ON_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "EDITOR"];
const DEVICE_MAX_IDLE_MS = 30 * 24 * 60 * 60 * 1000;

export function eligibleEvents(role: Role | string): StaffPushEvent[] {
  return PUSH_EVENTS.filter((event) => {
    if (event === "NEW_LEAD") return hasPermission(role, "USER_MANAGEMENT");
    if (event === "CONTENT_AWAITING_APPROVAL") return hasPermission(role, "APPROVE");
    // NEW_BOOKING: middleware.ts restricts SEO_MANAGER to the SEO tools.
    return role !== "SEO_MANAGER";
  });
}

export function defaultEnabled(role: Role | string, event: PushEvent): boolean {
  return isStaffPushEvent(event) && eligibleEvents(role).includes(event) && DEFAULT_ON_ROLES.includes(role as Role);
}

export function isPushEnabled(role: Role | string, event: PushEvent, preference: boolean | null | undefined): boolean {
  if (!isStaffPushEvent(event) || !eligibleEvents(role).includes(event)) return false;
  return preference ?? defaultEnabled(role, event);
}

/**
 * FCM tokens that should receive `event`. Also prunes devices not seen for
 * 30 days (the app re-registers, refreshing lastSeenAt, every time it opens).
 */
export async function recipientTokens(event: StaffPushEvent): Promise<string[]> {
  const cutoff = new Date(Date.now() - DEVICE_MAX_IDLE_MS);
  await prisma.pushDevice.deleteMany({ where: { lastSeenAt: { lt: cutoff } } });

  const devices = await prisma.pushDevice.findMany({
    // Logout/revoke already delete the row; the session check is a second guard.
    // userId set = a staff device; client devices (clientUserId) never get staff pushes.
    where: { lastSeenAt: { gte: cutoff }, userId: { not: null }, adminSession: { revokedAt: null } },
    select: {
      token: true,
      user: { select: { role: true, pushPreferences: { where: { event }, select: { enabled: true } } } },
    },
  });

  return devices
    .filter((d) => d.user !== null && isPushEnabled(d.user.role, event, d.user.pushPreferences[0]?.enabled))
    .map((d) => d.token);
}
