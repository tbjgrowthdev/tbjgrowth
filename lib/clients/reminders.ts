// The Client Hub reminder cron (/api/cron/client-reminders, every 15 minutes
// from .github/workflows/app-cron.yml):
// 1. Meeting reminders to the client about 24 h and 1 h before a confirmed
//    call booked from the portal.
// 2. DUE invoices past their due date become OVERDUE, and the client is told
//    once.
// 3. Active projects with no update within their interval
//    (getUpdateIntervalDays) nudge the project's account manager, by staff
//    push and email, at most once per interval. Never the client.
//
// Every "once" is a single raw UPDATE … WHERE <not yet done> RETURNING, so a
// cron that runs twice (or overlaps) never sends twice. Neon HTTP has no
// transactions.
import prisma from "@/lib/prisma";
import { notifyClients } from "@/lib/push/client-notify";
import { notifyStaffUser } from "@/lib/push/notify";
import { STALE_PROJECT_NUDGE } from "@/lib/push/messages";
import { sendStaleProjectNudge } from "@/lib/email";
import { findStaleProjects } from "@/lib/clients/updates";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type ReminderSummary = { meetingReminders: number; overdueInvoices: number; nudgedManagers: number; nudgedProjects: number; errors: string[] };

async function claimReminder(bookingId: string, which: "24h" | "1h", now: Date): Promise<boolean> {
  const rows =
    which === "24h"
      ? await prisma.$queryRaw<Array<{ id: string }>>`UPDATE "Booking" SET "reminder24hSentAt" = ${now} WHERE "id" = ${bookingId} AND "reminder24hSentAt" IS NULL RETURNING "id"`
      : await prisma.$queryRaw<Array<{ id: string }>>`UPDATE "Booking" SET "reminder1hSentAt" = ${now} WHERE "id" = ${bookingId} AND "reminder1hSentAt" IS NULL RETURNING "id"`;
  return rows.length === 1;
}

async function meetingReminders(now: Date): Promise<number> {
  const upcoming = await prisma.booking.findMany({
    where: { status: "CONFIRMED", clientUserId: { not: null }, slot: { startsAt: { gt: now, lte: new Date(now.getTime() + DAY_MS) } } },
    select: { id: true, reminder24hSentAt: true, reminder1hSentAt: true, slot: { select: { startsAt: true } }, clientUser: { select: { clientId: true } } },
  });
  let sent = 0;
  for (const b of upcoming) {
    if (!b.clientUser) continue;
    const startsIn = new Date(b.slot.startsAt).getTime() - now.getTime();
    // Within the hour: the 1 h reminder. Otherwise (up to a day ahead): the 24 h one.
    const which = startsIn <= HOUR_MS ? "1h" : "24h";
    if (which === "1h" ? b.reminder1hSentAt : b.reminder24hSentAt) continue;
    if (!(await claimReminder(b.id, which, now))) continue;
    await notifyClients("CLIENT_MEETING_REMINDER", b.clientUser.clientId);
    sent++;
  }
  return sent;
}

async function overdueInvoices(now: Date): Promise<number> {
  // Due date is a calendar day (stored as that day's 00:00 UTC): overdue
  // once that whole day has passed.
  const cutoff = new Date(now.getTime() - DAY_MS);
  const rows = await prisma.$queryRaw<Array<{ id: string; clientId: string }>>`
    UPDATE "Invoice" SET "status" = 'OVERDUE', "overdueNotifiedAt" = ${now}
    WHERE "status" = 'DUE' AND "dueDate" < ${cutoff} AND "overdueNotifiedAt" IS NULL
    RETURNING "id", "clientId"`;
  for (const clientId of new Set(rows.map((r) => r.clientId))) await notifyClients("CLIENT_INVOICE_OVERDUE", clientId);
  return rows.length;
}

async function staleProjectNudges(now: Date): Promise<{ managers: number; projects: number }> {
  const stale = await findStaleProjects(now);
  const byManager = new Map<string, typeof stale>();
  for (const p of stale) {
    if (!p.accountManagerId) continue;
    const cutoff = new Date(now.getTime() - p.intervalDays * DAY_MS);
    const claimed = await prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "Project" SET "lastUpdateNudgeAt" = ${now}
      WHERE "id" = ${p.id} AND ("lastUpdateNudgeAt" IS NULL OR "lastUpdateNudgeAt" <= ${cutoff})
      RETURNING "id"`;
    if (claimed.length !== 1) continue;
    byManager.set(p.accountManagerId, [...(byManager.get(p.accountManagerId) ?? []), p]);
  }
  for (const [managerId, projects] of byManager) {
    await notifyStaffUser(managerId, STALE_PROJECT_NUDGE);
    const manager = await prisma.user.findUnique({ where: { id: managerId }, select: { email: true, name: true } });
    if (manager?.email) {
      try {
        await sendStaleProjectNudge({ to: manager.email, name: manager.name, projects: projects.map((p) => ({ clientName: p.clientName, title: p.title, lastUpdateAt: p.lastUpdateAt, intervalDays: p.intervalDays })) });
      } catch (error) {
        console.error("[reminders] nudge email failed:", error);
      }
    }
  }
  return { managers: byManager.size, projects: [...byManager.values()].reduce((n, ps) => n + ps.length, 0) };
}

/** Runs all three; one part failing doesn't stop the others (listed in `errors`). */
export async function runClientReminders(now: Date = new Date()): Promise<ReminderSummary> {
  const summary: ReminderSummary = { meetingReminders: 0, overdueInvoices: 0, nudgedManagers: 0, nudgedProjects: 0, errors: [] };
  try {
    summary.meetingReminders = await meetingReminders(now);
  } catch (error) {
    console.error("[reminders] meetings failed:", error);
    summary.errors.push("meetings");
  }
  try {
    summary.overdueInvoices = await overdueInvoices(now);
  } catch (error) {
    console.error("[reminders] invoices failed:", error);
    summary.errors.push("invoices");
  }
  try {
    const n = await staleProjectNudges(now);
    summary.nudgedManagers = n.managers;
    summary.nudgedProjects = n.projects;
  } catch (error) {
    console.error("[reminders] stale projects failed:", error);
    summary.errors.push("stale-projects");
  }
  return summary;
}
