"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { now } from "@/lib/clients/clock";
import {
  completeMilestoneOnce,
  findStaleProjects,
  getHubSettings,
  isValidIntervalDays,
  postSystemUpdate,
  safeNotify,
  MAX_UPDATE_REMINDER_DAYS,
} from "@/lib/clients/updates";

// Client projects in the admin Clients section.
// - CLIENT_UPDATES (admins and editors): view projects, post updates.
// - CLIENT_MANAGEMENT (admins): projects, milestones, approval requests,
//   reminder settings.
// Every change is audit-logged. Pushes to the client never fail the change
// (lib/clients/updates.ts safeNotify).

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

function failure(error: unknown, fallback: string): { success: false; error: string } {
  if (error instanceof AuthError) return { success: false, error: error.message };
  console.error(`[client-projects] ${fallback}:`, error);
  return { success: false, error: fallback };
}

const STATUSES = ["NOT_STARTED", "IN_PROGRESS", "WAITING_ON_CLIENT", "COMPLETED"] as const;
const optionalDate = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return d;
  });
const intervalSchema = z
  .union([z.number(), z.null()])
  .optional()
  .refine((v) => v === undefined || v === null || isValidIntervalDays(v), `Reminder interval must be a whole number of days from 0 to ${MAX_UPDATE_REMINDER_DAYS}`);

const projectSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(STATUSES).optional(),
  progress: z.number().int().min(0, "Progress must be 0–100").max(100, "Progress must be 0–100").optional(),
  startDate: optionalDate,
  dueDate: optionalDate,
  updateIntervalDays: intervalSchema,
});

const updateSchema = z.object({
  body: z.string().trim().min(1, "Write the update first").max(2000),
  internalNote: z.string().max(2000).optional().nullable(),
  status: z.enum(STATUSES).optional(),
  notify: z.boolean().optional(),
});

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid input";

function revalidateProject(clientId: string, projectId?: string) {
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  if (projectId) revalidatePath(`/admin/clients/${clientId}/projects/${projectId}`);
}

async function projectRef(id: string) {
  return prisma.project.findUnique({ where: { id }, select: { id: true, clientId: true, title: true, status: true } });
}

// ---- reads ----

export async function listProjectsForAdmin(clientId: string) {
  try {
    await requirePermission("CLIENT_UPDATES");
    return await prisma.project.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true, progress: true, dueDate: true, updates: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
    });
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("[client-projects] list failed:", error);
    return [];
  }
}

/** Staff view of one project, including internal notes. */
export async function getProjectForAdmin(projectId: string) {
  try {
    await requirePermission("CLIENT_UPDATES");
    return await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        clientId: true,
        title: true,
        description: true,
        status: true,
        progress: true,
        startDate: true,
        dueDate: true,
        updateIntervalDays: true,
        client: { select: { id: true, name: true } },
        milestones: { orderBy: [{ order: "asc" }, { dueDate: "asc" }], select: { id: true, title: true, dueDate: true, doneAt: true } },
        updates: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, kind: true, body: true, internalNote: true, createdAt: true, author: { select: { name: true } } },
        },
        approvals: { orderBy: { createdAt: "desc" }, select: { id: true, title: true, status: true, response: true, respondedAt: true, createdAt: true } },
      },
    });
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("[client-projects] get failed:", error);
    return null;
  }
}

/** Every project (with its client) that staff can post to: for the quick-post picker. */
export async function listPostableProjects(clientId?: string) {
  try {
    await requirePermission("CLIENT_UPDATES");
    return await prisma.project.findMany({
      where: { ...(clientId ? { clientId } : {}), status: { not: "COMPLETED" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, clientId: true, client: { select: { name: true } } },
    });
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("[client-projects] postable failed:", error);
    return [];
  }
}

export async function listStaleProjects() {
  try {
    await requirePermission("CLIENT_UPDATES");
    return await findStaleProjects(now());
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("[client-projects] stale failed:", error);
    return [];
  }
}

export async function getUpdateReminderSettings() {
  try {
    await requirePermission("CLIENT_UPDATES");
    return await getHubSettings();
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("[client-projects] settings failed:", error);
    return null;
  }
}

// ---- projects ----

export async function createProject(clientId: string, input: z.input<typeof projectSchema>): Promise<Result<{ id: string }>> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return { success: false, error: "Client not found" };
    const d = parsed.data;
    const project = await prisma.project.create({
      data: {
        clientId,
        title: d.title,
        description: d.description?.trim() || null,
        status: d.status ?? "NOT_STARTED",
        progress: d.progress ?? 0,
        startDate: d.startDate ?? null,
        dueDate: d.dueDate ?? null,
        updateIntervalDays: d.updateIntervalDays ?? null,
      },
      select: { id: true, title: true },
    });
    await logAudit({ action: "create", category: "Content", entityType: "Project", entityId: project.id, entityLabel: project.title, after: { clientId, title: project.title } });
    revalidateProject(clientId, project.id);
    return { success: true, id: project.id };
  } catch (error) {
    return failure(error, "Couldn't create the project");
  }
}

export async function updateProject(projectId: string, input: z.input<typeof projectSchema>): Promise<Result> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    const before = await prisma.project.findUnique({
      where: { id: projectId },
      select: { clientId: true, title: true, status: true, progress: true, updateIntervalDays: true },
    });
    if (!before) return { success: false, error: "Project not found" };
    const d = parsed.data;
    const data = {
      title: d.title,
      description: d.description === undefined ? undefined : d.description?.trim() || null,
      status: d.status,
      progress: d.progress,
      startDate: d.startDate,
      dueDate: d.dueDate,
      updateIntervalDays: d.updateIntervalDays,
    };
    await prisma.project.update({ where: { id: projectId }, data });
    const { clientId, ...beforeFields } = before;
    await logAudit({
      action: "update",
      category: "Content",
      entityType: "Project",
      entityId: projectId,
      entityLabel: d.title,
      before: beforeFields,
      after: {
        title: d.title,
        status: d.status ?? before.status,
        progress: d.progress ?? before.progress,
        updateIntervalDays: d.updateIntervalDays === undefined ? before.updateIntervalDays : d.updateIntervalDays,
      },
    });
    revalidateProject(clientId, projectId);
    return { success: true };
  } catch (error) {
    return failure(error, "Couldn't save the project");
  }
}

export async function deleteProject(projectId: string): Promise<Result> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    const p = await projectRef(projectId);
    if (!p) return { success: false, error: "Project not found" };
    // Milestones, updates, attachments and approvals go with it (onDelete: Cascade).
    await prisma.project.delete({ where: { id: projectId } });
    await logAudit({ action: "delete", category: "Content", entityType: "Project", entityId: projectId, entityLabel: p.title, before: { clientId: p.clientId, title: p.title } });
    revalidateProject(p.clientId);
    return { success: true };
  } catch (error) {
    return failure(error, "Couldn't delete the project");
  }
}

// ---- updates ----

/** The quick-post form: under 30 seconds from a phone. Notifies the client unless `notify` is false. */
export async function postProjectUpdate(projectId: string, input: z.input<typeof updateSchema>): Promise<Result<{ id: string }>> {
  try {
    const session = await requirePermission("CLIENT_UPDATES");
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    const p = await projectRef(projectId);
    if (!p) return { success: false, error: "Project not found" };
    const d = parsed.data;
    const at = now();
    const update = await prisma.projectUpdate.create({
      data: { projectId, authorId: session.user.id, kind: "MANUAL", body: d.body, internalNote: d.internalNote?.trim() || null, createdAt: at },
      select: { id: true },
    });
    if (d.status && d.status !== p.status) await prisma.project.update({ where: { id: projectId }, data: { status: d.status } });
    if (d.notify !== false) {
      // Staff chose to notify: always send, and start the hour in which
      // automatic (milestone) updates stay quiet.
      await prisma.project.update({ where: { id: projectId }, data: { lastClientNotifyAt: at } });
      await safeNotify("CLIENT_PROJECT_UPDATE", p.clientId);
    }
    await logAudit({
      action: "post_update",
      category: "Content",
      entityType: "ProjectUpdate",
      entityId: update.id,
      entityLabel: p.title,
      after: { projectId, notify: d.notify !== false, ...(d.status && d.status !== p.status ? { status: d.status } : {}) },
    });
    revalidateProject(p.clientId, projectId);
    return { success: true, id: update.id };
  } catch (error) {
    return failure(error, "Couldn't post the update");
  }
}

// ---- milestones ----

export async function addMilestone(projectId: string, input: { title: string; dueDate?: string | Date | null }): Promise<Result<{ id: string }>> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    const parsed = z.object({ title: z.string().trim().min(1, "Title is required").max(200), dueDate: optionalDate }).safeParse(input);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    const p = await projectRef(projectId);
    if (!p) return { success: false, error: "Project not found" };
    const order = await prisma.projectMilestone.count({ where: { projectId } });
    const m = await prisma.projectMilestone.create({ data: { projectId, title: parsed.data.title, dueDate: parsed.data.dueDate ?? null, order }, select: { id: true } });
    await logAudit({ action: "create", category: "Content", entityType: "ProjectMilestone", entityId: m.id, entityLabel: parsed.data.title, after: { projectId } });
    revalidateProject(p.clientId, projectId);
    return { success: true, id: m.id };
  } catch (error) {
    return failure(error, "Couldn't add the milestone");
  }
}

/**
 * Done: marks it once (atomically) and posts one MILESTONE update, pushed at
 * most once per project per hour. Never completes the project itself.
 * Not done: clears it, no update.
 */
export async function setMilestoneDone(milestoneId: string, done: boolean): Promise<Result> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    if (typeof done !== "boolean") return { success: false, error: "Invalid input" };
    const m = await prisma.projectMilestone.findUnique({ where: { id: milestoneId }, select: { id: true, projectId: true, title: true, project: { select: { clientId: true } } } });
    if (!m) return { success: false, error: "Milestone not found" };
    const at = now();
    if (done) {
      const completed = await completeMilestoneOnce(m.id, at);
      if (completed) {
        await postSystemUpdate({ id: m.projectId, clientId: m.project.clientId }, "MILESTONE", `Milestone completed: ${completed.title}`, at);
        await logAudit({ action: "complete", category: "Content", entityType: "ProjectMilestone", entityId: m.id, entityLabel: m.title });
      }
    } else {
      await prisma.projectMilestone.update({ where: { id: m.id }, data: { doneAt: null } });
      await logAudit({ action: "reopen", category: "Content", entityType: "ProjectMilestone", entityId: m.id, entityLabel: m.title });
    }
    revalidateProject(m.project.clientId, m.projectId);
    return { success: true };
  } catch (error) {
    return failure(error, "Couldn't update the milestone");
  }
}

export async function deleteMilestone(milestoneId: string): Promise<Result> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    const m = await prisma.projectMilestone.findUnique({ where: { id: milestoneId }, select: { id: true, projectId: true, title: true, project: { select: { clientId: true } } } });
    if (!m) return { success: false, error: "Milestone not found" };
    await prisma.projectMilestone.delete({ where: { id: m.id } });
    await logAudit({ action: "delete", category: "Content", entityType: "ProjectMilestone", entityId: m.id, entityLabel: m.title, before: { projectId: m.projectId } });
    revalidateProject(m.project.clientId, m.projectId);
    return { success: true };
  } catch (error) {
    return failure(error, "Couldn't delete the milestone");
  }
}

// ---- approval requests ----

export async function createApprovalRequest(projectId: string, input: { title: string; description?: string | null }): Promise<Result<{ id: string }>> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    const parsed = z.object({ title: z.string().trim().min(1, "Title is required").max(200), description: z.string().max(5000).optional().nullable() }).safeParse(input);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    const p = await projectRef(projectId);
    if (!p) return { success: false, error: "Project not found" };
    const at = now();
    const approval = await prisma.approvalRequest.create({
      data: { projectId, title: parsed.data.title, description: parsed.data.description?.trim() || null, status: "PENDING", createdAt: at },
      select: { id: true },
    });
    await prisma.project.update({ where: { id: projectId }, data: { status: "WAITING_ON_CLIENT" } });
    // The approval push below is the notification; the feed entry stays quiet.
    await postSystemUpdate(p, "APPROVAL", `Approval requested: ${parsed.data.title}`, at, { notify: false });
    await safeNotify("CLIENT_APPROVAL_NEEDED", p.clientId);
    await logAudit({ action: "request_approval", category: "Approval", entityType: "ApprovalRequest", entityId: approval.id, entityLabel: parsed.data.title, after: { projectId } });
    revalidateProject(p.clientId, projectId);
    return { success: true, id: approval.id };
  } catch (error) {
    return failure(error, "Couldn't create the approval request");
  }
}

// ---- reminder settings ----

export async function setUpdateReminderDays(days: number): Promise<Result> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    if (!isValidIntervalDays(days)) return { success: false, error: `Use a whole number of days from 0 to ${MAX_UPDATE_REMINDER_DAYS} (0 turns reminders off)` };
    const before = await getHubSettings();
    const existing = await prisma.clientHubSetting.findUnique({ where: { id: "global" }, select: { id: true } });
    if (existing) await prisma.clientHubSetting.update({ where: { id: "global" }, data: { updateReminderDays: days } });
    else await prisma.clientHubSetting.create({ data: { id: "global", updateReminderDays: days } });
    await logAudit({
      action: "update",
      category: "Settings",
      entityType: "ClientHubSetting",
      entityId: "global",
      entityLabel: "Update reminders",
      before: { updateReminderDays: before.updateReminderDays },
      after: { updateReminderDays: days },
    });
    revalidatePath("/admin/clients");
    return { success: true };
  } catch (error) {
    return failure(error, "Couldn't save the reminder setting");
  }
}
