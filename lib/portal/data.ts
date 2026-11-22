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
export type RespondResult = { ok: true; projectId: string } | { ok: false; reason: "not_found" | "already_answered" };

/**
 * Records the client's answer to one of their own pending approvals. The
 * final write is conditional on status PENDING, so two taps (or two devices)
 * can't both answer.
 */
export async function respondToApproval(ctx: ClientContext, approvalId: string, answer: ApprovalDecision, now: Date = new Date()): Promise<RespondResult> {
  if (typeof approvalId !== "string" || !approvalId) return { ok: false, reason: "not_found" };
  const approval = await prisma.approvalRequest.findFirst({
    where: { id: approvalId, project: ownProject(ctx) },
    select: { id: true, status: true, projectId: true },
  });
  if (!approval) return { ok: false, reason: "not_found" };
  if (approval.status !== "PENDING") return { ok: false, reason: "already_answered" };

  const comment = typeof answer.comment === "string" ? answer.comment.trim().slice(0, 5000) : "";
  try {
    await prisma.approvalRequest.update({
      where: { id: approval.id, status: "PENDING" },
      data: { status: answer.decision, response: comment || null, respondedById: ctx.clientUserId, respondedAt: now },
      select: { id: true },
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2025") return { ok: false, reason: "already_answered" };
    throw error;
  }
  return { ok: true, projectId: approval.projectId };
}

// ── Reports ───────────────────────────────────────────────────────────────

const REPORT_FIELDS = { id: true, period: true, title: true, summary: true, metrics: true, publishedAt: true, fileKey: true, project: { select: { id: true, title: true } } } as const;

type ReportRow = { id: string; period: string; title: string; summary: string | null; metrics: unknown; publishedAt: Date | null; fileKey: string | null; project: { id: string; title: string } | null };

function shapeReport(r: ReportRow) {
  const { fileKey, ...rest } = r;
  return { ...rest, hasFile: !!fileKey };
}

/** Published reports only; drafts (publishedAt null) are staff-only. */
export async function listReports(ctx: ClientContext) {
  const rows = await prisma.report.findMany({
    where: { clientId: ctx.clientId, publishedAt: { not: null } },
    select: REPORT_FIELDS,
    orderBy: [{ period: "desc" }, { publishedAt: "desc" }],
  });
  return rows.map(shapeReport);
}

export async function getReport(ctx: ClientContext, reportId: string) {
  if (typeof reportId !== "string" || !reportId) return null;
  const r = await prisma.report.findFirst({
    where: { id: reportId, clientId: ctx.clientId, publishedAt: { not: null } },
    select: REPORT_FIELDS,
  });
  return r ? shapeReport(r) : null;
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
    data: { clientId: ctx.clientId, clientUserId: ctx.clientUserId, message: text },
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
    .map((b) => ({ id: b.id, startsAt: b.slot.startsAt, duration: b.slot.duration }))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
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
