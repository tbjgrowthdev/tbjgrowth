// The Client Hub's only door to the database.
//
// Rules (tests/portal-tenancy.test.ts holds them):
// 1. Every function takes the ClientContext from requireClient() and scopes
//    every query by ctx.clientId (or ctx.clientUserId). Nothing here accepts
//    a client id from a request.
// 2. Every query has an explicit `select`. Staff-only columns
//    (Client.notes, ProjectUpdate.internalNote, Client.accountManagerId,
//    ProjectUpdate.authorId) and raw R2 file keys are never selected, except
//    getClientFile(), which returns a key only to the authenticated file
//    route after the same ownership check.
// 3. A record that exists but belongs to another client looks exactly like a
//    record that doesn't exist (null / empty / "not_found").
// 4. Neon HTTP: single-statement writes only (docs/known-limitations.md).
//
// Pages and Server Actions under /portal never import @/lib/prisma themselves.
import prisma from "@/lib/prisma";
import type { ClientContext } from "@/lib/portal/auth";
import { postSystemUpdate } from "@/lib/clients/updates";

const PROJECT_FIELDS = {
  id: true,
  title: true,
  description: true,
  status: true,
  progress: true,
  startDate: true,
  dueDate: true,
} as const;

const MILESTONE_FIELDS = { id: true, title: true, dueDate: true, doneAt: true, order: true } as const;

const APPROVAL_FIELDS = {
  id: true,
  title: true,
  description: true,
  status: true,
  response: true,
  respondedAt: true,
  createdAt: true,
} as const;

const UPDATE_FIELDS = {
  id: true,
  kind: true,
  body: true,
  createdAt: true,
  author: { select: { name: true } },
  attachments: { select: { id: true, name: true } },
} as const;

type UpdateRow = {
  id: string;
  kind: string;
  body: string;
  createdAt: Date;
  author: { name: string | null } | null;
  attachments: Array<{ id: string; name: string }>;
};

function shapeUpdate(u: UpdateRow) {
  return { id: u.id, kind: u.kind, body: u.body, createdAt: u.createdAt, authorName: u.author?.name ?? null, attachments: u.attachments };
}

const ownProject = (ctx: ClientContext) => ({ clientId: ctx.clientId });

// ── Projects ──────────────────────────────────────────────────────────────

export async function listProjects(ctx: ClientContext) {
  return prisma.project.findMany({
    where: ownProject(ctx),
    select: PROJECT_FIELDS,
    orderBy: { createdAt: "desc" },
  });
}

export async function getProject(ctx: ClientContext, projectId: string) {
  if (typeof projectId !== "string" || !projectId) return null;
  const p = await prisma.project.findFirst({
    where: { id: projectId, ...ownProject(ctx) },
    select: {
      ...PROJECT_FIELDS,
      milestones: { select: MILESTONE_FIELDS, orderBy: [{ order: "asc" }, { dueDate: "asc" }] },
      updates: { select: UPDATE_FIELDS, orderBy: { createdAt: "desc" }, take: 50 },
      approvals: { select: APPROVAL_FIELDS, orderBy: { createdAt: "desc" } },
    },
  });
  if (!p) return null;
  return { ...p, updates: p.updates.map(shapeUpdate) };
}

export async function listMilestones(ctx: ClientContext, projectId: string) {
  if (typeof projectId !== "string" || !projectId) return [];
  return prisma.projectMilestone.findMany({
    where: { projectId, project: ownProject(ctx) },
    select: MILESTONE_FIELDS,
    orderBy: [{ order: "asc" }, { dueDate: "asc" }],
  });
}

/** Newest updates across all of the client's projects. */
export async function listRecentUpdates(ctx: ClientContext, limit = 10) {
  const rows = await prisma.projectUpdate.findMany({
    where: { project: ownProject(ctx) },
    select: { ...UPDATE_FIELDS, project: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(1, limit), 50),
  });
  return rows.map((u) => ({
    ...shapeUpdate(u),
    projectId: u.project.id,
    projectTitle: u.project.title,
  }));
}

// ── Approvals ─────────────────────────────────────────────────────────────

export async function listApprovals(ctx: ClientContext, opts: { status?: "PENDING" | "APPROVED" | "CHANGES_REQUESTED" } = {}) {
  const rows = await prisma.approvalRequest.findMany({
    where: { project: ownProject(ctx), ...(opts.status ? { status: opts.status } : {}) },
    select: { ...APPROVAL_FIELDS, project: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(({ project, ...a }) => ({
    ...a,
    projectId: project.id,
    projectTitle: project.title,
  }));
}

export type ApprovalDecision = { decision: "APPROVED" | "CHANGES_REQUESTED"; comment?: string | null };
export type RespondResult =
  | { ok: true; projectId: string; title: string }
  | { ok: false; reason: "not_found" | "already_answered" | "invalid_decision" | "comment_required" };

/**
 * Records the client's answer to one of their own pending approvals.
 * - The decision is checked at runtime (only APPROVED / CHANGES_REQUESTED);
 *   asking for changes needs a comment.
 * - The answer is one atomic UPDATE … WHERE status = 'PENDING', so two taps
 *   (or two devices) can't both answer.
 * - Then, best effort: the answer is posted to the project feed (no push:
 *   the client did it) and the project goes back to IN_PROGRESS once no
 *   approval is pending.
 */
export async function respondToApproval(ctx: ClientContext, approvalId: string, answer: ApprovalDecision, now: Date = new Date()): Promise<RespondResult> {
  if (typeof approvalId !== "string" || !approvalId) return { ok: false, reason: "not_found" };
  const decision = answer?.decision;
  if (decision !== "APPROVED" && decision !== "CHANGES_REQUESTED") return { ok: false, reason: "invalid_decision" };
  const comment = typeof answer.comment === "string" ? answer.comment.trim().slice(0, 5000) : "";
  if (decision === "CHANGES_REQUESTED" && !comment) return { ok: false, reason: "comment_required" };

  const approval = await prisma.approvalRequest.findFirst({
    where: { id: approvalId, project: ownProject(ctx) },
    select: { id: true, status: true, title: true, projectId: true, project: { select: { id: true, clientId: true, status: true } } },
  });
  if (!approval) return { ok: false, reason: "not_found" };
  if (approval.status !== "PENDING") return { ok: false, reason: "already_answered" };

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "ApprovalRequest"
    SET "status" = CAST(${decision} AS "ApprovalRequestStatus"), "response" = ${comment || null}, "respondedById" = ${ctx.clientUserId}, "respondedAt" = ${now}
    WHERE "id" = ${approval.id} AND "status" = 'PENDING'
    RETURNING "id"`;
  if (rows.length !== 1) return { ok: false, reason: "already_answered" };

  try {
    const body = `${decision === "APPROVED" ? "Approved" : "Changes requested"}: ${approval.title}`;
    await postSystemUpdate(approval.project, "APPROVAL", body, now, { notify: false });
    const stillPending = await prisma.approvalRequest.count({ where: { projectId: approval.projectId, status: "PENDING" } });
    if (stillPending === 0 && approval.project.status === "WAITING_ON_CLIENT") {
      await prisma.project.update({ where: { id: approval.projectId }, data: { status: "IN_PROGRESS" } });
    }
  } catch (error) {
    // The answer itself is saved; staff see it on the project page either way.
    console.error("[portal] follow-up after an approval answer failed:", error);
  }
  return { ok: true, projectId: approval.projectId, title: approval.title };
}

// ── Reports ───────────────────────────────────────────────────────────────

const REPORT_FIELDS = { id: true, period: true, title: true, summary: true, metrics: true, publishedAt: true, fileKey: true, project: { select: { id: true, title: true, clientId: true } } } as const;

type ReportRow = { id: string; period: string; title: string; summary: string | null; metrics: unknown; publishedAt: Date | null; fileKey: string | null; project: { id: string; title: string; clientId: string } | null };

// The schema doesn't tie Report.projectId to the report's client, so a
// project of another client is dropped here (the admin action refuses it too).
function shapeReport(ctx: ClientContext, r: ReportRow) {
  const { fileKey, project, ...rest } = r;
  return { ...rest, project: project && project.clientId === ctx.clientId ? { id: project.id, title: project.title } : null, hasFile: !!fileKey };
}

/** Published reports only; drafts (publishedAt null) are staff-only. */
export async function listReports(ctx: ClientContext) {
  const rows = await prisma.report.findMany({
    where: { clientId: ctx.clientId, publishedAt: { not: null } },
    select: REPORT_FIELDS,
    orderBy: [{ period: "desc" }, { publishedAt: "desc" }],
  });
  return rows.map((r) => shapeReport(ctx, r));
}

export async function getReport(ctx: ClientContext, reportId: string) {
  if (typeof reportId !== "string" || !reportId) return null;
  const r = await prisma.report.findFirst({
    where: { id: reportId, clientId: ctx.clientId, publishedAt: { not: null } },
    select: REPORT_FIELDS,
  });
  return r ? shapeReport(ctx, r) : null;
}

// ── Invoices ──────────────────────────────────────────────────────────────

/** Every non-void invoice, newest first. Amounts are integer minor units. */
export async function listInvoices(ctx: ClientContext) {
  const rows = await prisma.invoice.findMany({
    where: { clientId: ctx.clientId, status: { not: "VOID" } },
    select: { id: true, number: true, amountMinor: true, currency: true, status: true, issueDate: true, dueDate: true, fileKey: true },
    orderBy: { issueDate: "desc" },
  });
  return rows.map(({ fileKey, ...rest }) => ({ ...rest, hasFile: !!fileKey }));
}

// ── Requests ──────────────────────────────────────────────────────────────

export async function listRequests(ctx: ClientContext) {
  return prisma.clientRequest.findMany({
    where: { clientId: ctx.clientId },
    select: { id: true, message: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export const MAX_REQUEST_LENGTH = 2000;

export async function createClientRequest(ctx: ClientContext, message: string): Promise<{ ok: true; id: string } | { ok: false; reason: "empty" | "too_long" }> {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > MAX_REQUEST_LENGTH) return { ok: false, reason: "too_long" };
  const row = await prisma.clientRequest.create({
    data: { clientId: ctx.clientId, clientUserId: ctx.clientUserId, message: text, status: "OPEN" },
    select: { id: true },
  });
  return { ok: true, id: row.id };
}

// ── Meetings ──────────────────────────────────────────────────────────────

/** Upcoming confirmed calls booked by anyone at the client. */
export async function listMeetings(ctx: ClientContext, now: Date = new Date()) {
  const rows = await prisma.booking.findMany({
    where: { clientUser: { clientId: ctx.clientId }, status: "CONFIRMED", slot: { startsAt: { gte: now } } },
    select: { id: true, slot: { select: { startsAt: true, duration: true } } },
    take: 20,
  });
  return rows
    .flatMap((b) => (b.slot ? [{ id: b.id, startsAt: b.slot.startsAt, duration: b.slot.duration }] : []))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Free future slots anyone can book (the same pool as the public /book-a-call page). */
export async function listOpenSlots(ctx: ClientContext, now: Date = new Date()) {
  void ctx; // slots aren't per client; the context still marks this as a signed-in portal read
  const rows = await prisma.availableSlot.findMany({
    where: { isBooked: false, startsAt: { gt: now } },
    select: { id: true, startsAt: true, duration: true },
    orderBy: { startsAt: "asc" },
    take: 60,
  });
  return rows;
}

export type BookResult = { ok: true; bookingId: string; startsAt: Date; duration: number; name: string; email: string; company: string } | { ok: false; reason: "taken" | "not_found" };

/**
 * Books a call for the signed-in client user, prefilled from their account.
 * The slot is claimed with one atomic UPDATE (free and in the future), and
 * Booking.slotId's unique index still protects against a public booking
 * that got there first. If writing the booking fails for another reason the
 * slot is released again.
 */
export async function bookCall(ctx: ClientContext, slotId: string, input: { message?: string | null }, now: Date = new Date()): Promise<BookResult> {
  if (typeof slotId !== "string" || !slotId) return { ok: false, reason: "not_found" };
  const user = await prisma.clientUser.findFirst({ where: { id: ctx.clientUserId, clientId: ctx.clientId }, select: { name: true, email: true, client: { select: { name: true } } } });
  if (!user) return { ok: false, reason: "not_found" };
  const claimed = await prisma.$queryRaw<Array<{ id: string; startsAt: Date; duration: number }>>`
    UPDATE "AvailableSlot" SET "isBooked" = true, "updatedAt" = ${now}
    WHERE "id" = ${slotId} AND "isBooked" = false AND "startsAt" > ${now}
    RETURNING "id", "startsAt", "duration"`;
  if (claimed.length !== 1) return { ok: false, reason: "taken" };
  const message = typeof input.message === "string" ? input.message.trim().slice(0, 2000) || null : null;
  const create = () =>
    prisma.booking.create({
      data: { slotId, name: user.name, email: user.email, company: user.client.name, message, status: "CONFIRMED", clientUserId: ctx.clientUserId },
      select: { id: true },
    });
  try {
    let booking;
    try {
      booking = await create();
    } catch (error) {
      if ((error as { code?: string })?.code !== "P2002") throw error;
      // The slot's unique slotId is held. Staff cancelling a booking frees the
      // slot (isBooked=false) but keeps the CANCELLED row; that row gives way:
      // it's kept, detached from the slot, with the time it was for copied onto
      // it. A CONFIRMED one means the slot really is taken: it stays booked.
      const holder = await prisma.booking.findUnique({ where: { slotId }, select: { id: true, status: true } });
      if (holder?.status !== "CANCELLED") return { ok: false, reason: "taken" };
      try {
        await prisma.booking.update({
          where: { id: holder.id, status: "CANCELLED", slotId },
          data: { slotId: null, slotStartsAt: new Date(claimed[0].startsAt), slotDuration: claimed[0].duration },
          select: { id: true },
        });
      } catch (gone) {
        if ((gone as { code?: string })?.code !== "P2025") throw gone;
      }
      try {
        booking = await create();
      } catch (again) {
        if ((again as { code?: string })?.code === "P2002") return { ok: false, reason: "taken" };
        throw again;
      }
    }
    return { ok: true, bookingId: booking.id, startsAt: new Date(claimed[0].startsAt), duration: claimed[0].duration, name: user.name, email: user.email, company: user.client.name };
  } catch (error) {
    try {
      await prisma.availableSlot.update({ where: { id: slotId }, data: { isBooked: false } });
    } catch (release) {
      console.error("[portal] couldn't release a slot after a failed booking:", release);
    }
    throw error;
  }
}

// ── Profile ───────────────────────────────────────────────────────────────

export async function getProfile(ctx: ClientContext) {
  const u = await prisma.clientUser.findFirst({
    where: { id: ctx.clientUserId, clientId: ctx.clientId },
    select: {
      id: true,
      name: true,
      email: true,
      language: true,
      deletionRequestedAt: true,
      client: { select: { name: true, whatsapp: true, phone: true, accountManager: { select: { name: true } } } },
    },
  });
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    language: u.language,
    deletionRequestedAt: u.deletionRequestedAt,
    clientName: u.client.name,
    whatsapp: u.client.whatsapp,
    phone: u.client.phone,
    accountManagerName: u.client.accountManager?.name ?? null,
  };
}

export async function setLanguage(ctx: ClientContext, language: unknown): Promise<boolean> {
  if (language !== "en" && language !== "bn") return false;
  const u = await prisma.clientUser.findFirst({ where: { id: ctx.clientUserId, clientId: ctx.clientId }, select: { id: true } });
  if (!u) return false;
  await prisma.clientUser.update({ where: { id: u.id }, data: { language } });
  return true;
}

/** Records an account-deletion request (deletion itself is a manual staff step). `first` is false when it was already requested. */
export async function requestAccountDeletion(ctx: ClientContext, now: Date = new Date()): Promise<{ ok: true; first: boolean } | { ok: false }> {
  const u = await prisma.clientUser.findFirst({ where: { id: ctx.clientUserId, clientId: ctx.clientId }, select: { id: true, deletionRequestedAt: true } });
  if (!u) return { ok: false };
  if (u.deletionRequestedAt) return { ok: true, first: false };
  await prisma.clientUser.update({ where: { id: u.id }, data: { deletionRequestedAt: now } });
  return { ok: true, first: true };
}

/**
 * Where staff mail about this client goes: the account manager, else the
 * site's notification email. Never shown to the client (server-side only).
 */
export async function staffContactFor(ctx: ClientContext): Promise<{ to: string | null; clientName: string; userName: string; userEmail: string } | null> {
  const u = await prisma.clientUser.findFirst({
    where: { id: ctx.clientUserId, clientId: ctx.clientId },
    select: { name: true, email: true, client: { select: { name: true, accountManager: { select: { email: true } } } } },
  });
  if (!u) return null;
  const site = u.client.accountManager?.email ? null : await prisma.siteSetting.findFirst({ select: { email: true } });
  return { to: u.client.accountManager?.email ?? site?.email ?? null, clientName: u.client.name, userName: u.name, userEmail: u.email };
}

/** The site's notification email (Site Settings), where public and portal bookings are announced. Server-side only. */
export async function bookingNotifyEmail(ctx: ClientContext): Promise<string | null> {
  void ctx;
  const site = await prisma.siteSetting.findFirst({ select: { email: true } });
  return site?.email ?? null;
}

// ── Files ─────────────────────────────────────────────────────────────────

export type ClientFileKind = "attachment" | "report" | "invoice";

/**
 * The R2 key behind one of the client's own files, for /api/portal/files
 * only. Null for anything that isn't theirs, isn't published, or has no file.
 */
export async function getClientFile(ctx: ClientContext, kind: ClientFileKind, id: string): Promise<{ fileKey: string; name: string } | null> {
  if (typeof id !== "string" || !id) return null;
  if (kind === "attachment") {
    const a = await prisma.projectAttachment.findFirst({
      where: { id, update: { project: ownProject(ctx) } },
      select: { fileKey: true, name: true },
    });
    return a ? { fileKey: a.fileKey, name: a.name } : null;
  }
  if (kind === "report") {
    const r = await prisma.report.findFirst({
      where: { id, clientId: ctx.clientId, publishedAt: { not: null } },
      select: { fileKey: true, period: true },
    });
    return r?.fileKey ? { fileKey: r.fileKey, name: `report-${r.period}.pdf` } : null;
  }
  if (kind === "invoice") {
    const i = await prisma.invoice.findFirst({
      where: { id, clientId: ctx.clientId, status: { not: "VOID" } },
      select: { fileKey: true, number: true },
    });
    return i?.fileKey ? { fileKey: i.fileKey, name: `invoice-${i.number}.pdf` } : null;
  }
  return null;
}
