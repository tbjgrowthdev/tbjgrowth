// Project updates for the Client Hub: templates, system updates, the
// once-an-hour push collapse, the update-reminder interval and the stale
// project list. Shared by the admin actions (app/(admin)/actions/
// client-projects.ts), the portal approval flow (Task 8) and the reminder
// cron (Task 10).
//
// Neon HTTP: no transactions. "Only once" steps are single raw
// UPDATE … WHERE … RETURNING statements (atomic in Postgres); Prisma's
// update() with extra where conditions may read and write separately.
import prisma from "@/lib/prisma";
import { notifyClients, type ClientPushEvent } from "@/lib/push/client-notify";

export const DEFAULT_UPDATE_REMINDER_DAYS = 7;
export const MAX_UPDATE_REMINDER_DAYS = 60;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Statuses that count as "work going on": the stale list and nudges only look at these. */
export const ACTIVE_PROJECT_STATUSES = ["IN_PROGRESS", "WAITING_ON_CLIENT"] as const;

/** Prefill text for the quick-post form. Staff can edit before posting. */
export const UPDATE_TEMPLATES = [
  { id: "review", en: "Design draft ready for your review.", bn: "ডিজাইনের খসড়া তৈরি, দেখে মতামত দিন।" },
  { id: "started", en: "Content received, work started.", bn: "কনটেন্ট পেয়েছি, কাজ শুরু হয়েছে।" },
  { id: "staging", en: "Staging link ready.", bn: "টেস্ট লিংক তৈরি।" },
  { id: "progress", en: "Good progress this week.", bn: "এই সপ্তাহে কাজ ভালোভাবে এগিয়েছে।" },
  { id: "delivered", en: "Delivered.", bn: "কাজ হস্তান্তর করা হয়েছে।" },
] as const;

export function isValidIntervalDays(days: unknown): days is number {
  return typeof days === "number" && Number.isInteger(days) && days >= 0 && days <= MAX_UPDATE_REMINDER_DAYS;
}

/** The only place that decides a project's reminder interval. 0 = reminders off. */
export function getUpdateIntervalDays(project: { updateIntervalDays: number | null }, settings: { updateReminderDays: number }): number {
  return project.updateIntervalDays ?? settings.updateReminderDays;
}

export async function getHubSettings(): Promise<{ updateReminderDays: number }> {
  const row = await prisma.clientHubSetting.findUnique({ where: { id: "global" }, select: { updateReminderDays: true } });
  return { updateReminderDays: row?.updateReminderDays ?? DEFAULT_UPDATE_REMINDER_DAYS };
}

export type StaleProject = {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  accountManagerId: string | null;
  lastUpdateAt: Date | null;
  intervalDays: number;
  lastUpdateNudgeAt: Date | null;
};

/**
 * Active projects with no update within their interval. A project that has
 * never had an update counts from when it was created, so a new project
 * isn't stale on day one.
 */
export async function findStaleProjects(now: Date): Promise<StaleProject[]> {
  const settings = await getHubSettings();
  const projects = await prisma.project.findMany({
    where: { status: { in: [...ACTIVE_PROJECT_STATUSES] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      clientId: true,
      createdAt: true,
      updateIntervalDays: true,
      lastUpdateNudgeAt: true,
      client: { select: { name: true, accountManagerId: true } },
      updates: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  const stale: StaleProject[] = [];
  for (const p of projects) {
    const intervalDays = getUpdateIntervalDays(p, settings);
    if (intervalDays === 0) continue;
    const lastUpdateAt = p.updates[0]?.createdAt ?? null;
    const since = lastUpdateAt ?? p.createdAt;
    if (now.getTime() - new Date(since).getTime() < intervalDays * DAY_MS) continue;
    stale.push({
      id: p.id,
      title: p.title,
      clientId: p.clientId,
      clientName: p.client.name,
      accountManagerId: p.client.accountManagerId,
      lastUpdateAt,
      intervalDays,
      lastUpdateNudgeAt: p.lastUpdateNudgeAt,
    });
  }
  return stale;
}

/** Claims this project's one client push for the hour. True for the caller that gets it. */
export async function claimClientNotify(projectId: string, now: Date): Promise<boolean> {
  const cutoff = new Date(now.getTime() - HOUR_MS);
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "Project" SET "lastClientNotifyAt" = ${now}
    WHERE "id" = ${projectId} AND ("lastClientNotifyAt" IS NULL OR "lastClientNotifyAt" <= ${cutoff})
    RETURNING "id"`;
  return rows.length === 1;
}

/** A push must never fail the change that caused it. */
export async function safeNotify(event: ClientPushEvent, clientId: string): Promise<void> {
  try {
    await notifyClients(event, clientId);
  } catch (error) {
    console.error(`[clients] push ${event} failed:`, error);
  }
}

/** Posts a system update (no author) and pushes the client at most once per project per hour. */
export async function postSystemUpdate(
  project: { id: string; clientId: string },
  kind: "MILESTONE" | "APPROVAL",
  body: string,
  now: Date,
  opts: { notify?: boolean } = {}
): Promise<void> {
  await prisma.projectUpdate.create({ data: { projectId: project.id, authorId: null, kind, body: body.slice(0, 2000), createdAt: now } });
  if (opts.notify === false) return;
  if (await claimClientNotify(project.id, now)) await safeNotify("CLIENT_PROJECT_UPDATE", project.clientId);
}

/** Marks a milestone done once. Returns it only for the caller that completed it. */
export async function completeMilestoneOnce(milestoneId: string, now: Date): Promise<{ id: string; projectId: string; title: string } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; projectId: string; title: string }>>`
    UPDATE "ProjectMilestone" SET "doneAt" = ${now}
    WHERE "id" = ${milestoneId} AND "doneAt" IS NULL
    RETURNING "id", "projectId", "title"`;
  return rows[0] ?? null;
}

/**
 * A staff-written update. `attach` runs after the update row exists and
 * before anything else; if it throws, the update is deleted again and the
 * error rethrown, so the client is never pushed about an update whose file
 * is missing. The push (when `notify`) is the very last step.
 */
export async function postManualUpdate(
  project: { id: string; clientId: string; status: string },
  input: { authorId: string; body: string; internalNote: string | null; status?: string; notify: boolean },
  now: Date,
  attach?: (updateId: string) => Promise<void>
): Promise<{ id: string }> {
  const update = await prisma.projectUpdate.create({
    data: { projectId: project.id, authorId: input.authorId, kind: "MANUAL", body: input.body, internalNote: input.internalNote, createdAt: now },
    select: { id: true },
  });
  if (attach) {
    try {
      await attach(update.id);
    } catch (error) {
      try {
        await prisma.projectUpdate.delete({ where: { id: update.id } });
      } catch (cleanup) {
        console.error("[clients] couldn't take back an update after its attachment failed:", cleanup);
      }
      throw error;
    }
  }
  if (input.status && input.status !== project.status) {
    await prisma.project.update({ where: { id: project.id }, data: { status: input.status as never } });
  }
  if (input.notify) {
    // Staff chose to notify: always send, and start the hour in which
    // automatic (milestone) updates stay quiet.
    await prisma.project.update({ where: { id: project.id }, data: { lastClientNotifyAt: now } });
    await safeNotify("CLIENT_PROJECT_UPDATE", project.clientId);
  }
  return update;
}
