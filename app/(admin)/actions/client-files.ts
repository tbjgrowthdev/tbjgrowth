"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { now } from "@/lib/clients/clock";
import { postManualUpdate, safeNotify } from "@/lib/clients/updates";
import { checkUpload, deleteClientFile, parseReportMetrics, storeClientFile } from "@/lib/portal/files";

// Reports, invoices and update attachments for the admin Clients section.
// - CLIENT_UPDATES (admins, editors): add and publish reports, attach files to updates.
// - CLIENT_MANAGEMENT (admins): delete reports, everything about invoices.
// Uploads (PDF/PNG/JPG, 10 MB) go to the private CLIENT_FILES bucket under
// clients/{clientId}/{uuid}; only the key is stored. Order without
// transactions: file first, then the row; if the row fails the file is
// deleted again, so a row never points at a missing file.

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

function failure(error: unknown, fallback: string): { success: false; error: string } {
  if (error instanceof AuthError) return { success: false, error: error.message };
  console.error(`[client-files] ${fallback}:`, error);
  return { success: false, error: fallback };
}

const str = (fd: FormData, k: string, max = 500): string => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};
/** A display name for an uploaded file: no line breaks, quotes, slashes or backslashes; at most 120 characters. */
const safeFileName = (name: string | undefined): string => (name || "file").replace(/[\r\n"\\/]+/g, "-").slice(0, 120);
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const CURRENCIES = ["BDT", "GBP"] as const;
const INVOICE_STATUSES = ["DUE", "PAID", "OVERDUE", "VOID"] as const;
type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
const MAX_MINOR = 2_147_483_647; // Invoice.amountMinor is a Postgres integer

/** "15000.50" -> 1500050. Null for anything that isn't a positive amount with at most 2 decimals. */
function toMinorUnits(raw: string): number | null {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(raw.replace(/,/g, ""));
  if (!m) return null;
  const minor = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return minor > 0 && minor <= MAX_MINOR ? minor : null;
}

function day(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function revalidateClient(clientId: string) {
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/admin/clients/${clientId}/reports`);
  revalidatePath(`/admin/clients/${clientId}/invoices`);
}

// ---- reads (staff) ----

export async function listReportsForAdmin(clientId: string) {
  try {
    await requirePermission("CLIENT_UPDATES");
    return await prisma.report.findMany({
      where: { clientId },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
      select: { id: true, period: true, title: true, summary: true, metrics: true, publishedAt: true, project: { select: { title: true } } },
    });
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("[client-files] reports failed:", error);
    return [];
  }
}

export async function listInvoicesForAdmin(clientId: string) {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    return await prisma.invoice.findMany({
      where: { clientId },
      orderBy: { issueDate: "desc" },
      select: { id: true, number: true, amountMinor: true, currency: true, status: true, issueDate: true, dueDate: true, fileKey: true },
    });
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("[client-files] invoices failed:", error);
    return [];
  }
}

// ---- reports ----

export async function createReport(fd: FormData): Promise<Result<{ id: string }>> {
  try {
    await requirePermission("CLIENT_UPDATES");
    const clientId = str(fd, "clientId", 100);
    const projectId = str(fd, "projectId", 100) || null;
    const period = str(fd, "period", 7);
    const title = str(fd, "title", 200);
    const summary = str(fd, "summary", 2000) || null;
    const publish = fd.get("publish") === "on" || fd.get("publish") === "true";
    if (!PERIOD.test(period)) return { success: false, error: "Period must look like 2026-10" };
    if (!title) return { success: false, error: "Title is required" };
    const metrics = parseReportMetrics(fd.get("metrics"));
    if (!metrics.ok) return { success: false, error: metrics.error };

    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return { success: false, error: "Client not found" };
    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { clientId: true } });
      if (!project || project.clientId !== clientId) return { success: false, error: "That project belongs to another client" };
    }
    const upload = await checkUpload(fd.get("file"));
    if (!upload.ok) return { success: false, error: upload.error };

    const fileKey = await storeClientFile(clientId, upload);
    const at = now();
    let report;
    try {
      report = await prisma.report.create({
        data: { clientId, projectId, period, title, summary, metrics: metrics.metrics ?? undefined, fileKey, publishedAt: publish ? at : null, createdAt: at },
        select: { id: true },
      });
    } catch (error) {
      await deleteClientFile(fileKey);
      throw error;
    }
    if (publish) await safeNotify("CLIENT_REPORT_READY", clientId);
    await logAudit({ action: "create", category: "Content", entityType: "Report", entityId: report.id, entityLabel: `${period} ${title}`, after: { clientId, period, published: publish } });
    revalidateClient(clientId);
    return { success: true, id: report.id };
  } catch (error) {
    return failure(error, "Couldn't save the report");
  }
}

/** Publish (client sees it, pushed once) or take back to draft. */
export async function setReportPublished(reportId: string, published: boolean): Promise<Result> {
  try {
    await requirePermission("CLIENT_UPDATES");
    if (typeof published !== "boolean") return { success: false, error: "Invalid input" };
    const r = await prisma.report.findUnique({ where: { id: reportId }, select: { id: true, clientId: true, title: true } });
    if (!r) return { success: false, error: "Report not found" };
    if (published) {
      // One atomic statement: only the call that actually publishes notifies.
      const rows = await prisma.$queryRaw<Array<{ id: string; clientId: string }>>`
        UPDATE "Report" SET "publishedAt" = ${now()}
        WHERE "id" = ${r.id} AND "publishedAt" IS NULL
        RETURNING "id", "clientId"`;
      if (rows.length === 1) {
        await safeNotify("CLIENT_REPORT_READY", r.clientId);
        await logAudit({ action: "publish", category: "Publishing", entityType: "Report", entityId: r.id, entityLabel: r.title });
      }
    } else {
      await prisma.report.update({ where: { id: r.id }, data: { publishedAt: null } });
      await logAudit({ action: "unpublish", category: "Publishing", entityType: "Report", entityId: r.id, entityLabel: r.title });
    }
    revalidateClient(r.clientId);
    return { success: true };
  } catch (error) {
    return failure(error, "Couldn't change the report");
  }
}

export async function deleteReport(reportId: string): Promise<Result> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    const r = await prisma.report.findUnique({ where: { id: reportId }, select: { id: true, clientId: true, title: true, period: true, fileKey: true } });
    if (!r) return { success: false, error: "Report not found" };
    await prisma.report.delete({ where: { id: r.id } });
    await deleteClientFile(r.fileKey);
    await logAudit({ action: "delete", category: "Content", entityType: "Report", entityId: r.id, entityLabel: `${r.period} ${r.title}`, before: { clientId: r.clientId } });
    revalidateClient(r.clientId);
    return { success: true };
  } catch (error) {
    return failure(error, "Couldn't delete the report");
  }
}

// ---- invoices ----

export async function createInvoice(fd: FormData): Promise<Result<{ id: string }>> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    const clientId = str(fd, "clientId", 100);
    const number = str(fd, "number", 60);
    const amountMinor = toMinorUnits(str(fd, "amount", 20));
    const currency = str(fd, "currency", 3) as (typeof CURRENCIES)[number];
    const issueDate = day(str(fd, "issueDate", 10));
    const dueDate = day(str(fd, "dueDate", 10));
    const status = (str(fd, "status", 10) || "DUE") as InvoiceStatus;
    if (!number) return { success: false, error: "Invoice number is required" };
    if (amountMinor === null) return { success: false, error: "Enter the amount as a positive number with at most 2 decimals" };
    if (!CURRENCIES.includes(currency)) return { success: false, error: "Currency must be BDT or GBP" };
    if (!issueDate || !dueDate) return { success: false, error: "Enter the issue and due dates" };
    if (dueDate < issueDate) return { success: false, error: "The due date can't be before the issue date" };
    if (status !== "DUE" && status !== "PAID") return { success: false, error: "A new invoice is either due or paid" };
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return { success: false, error: "Client not found" };

    const file = fd.get("file");
    let fileKey: string | null = null;
    if (file instanceof File && file.size > 0) {
      const upload = await checkUpload(file);
      if (!upload.ok) return { success: false, error: upload.error };
      fileKey = await storeClientFile(clientId, upload);
    }
    let invoice;
    try {
      invoice = await prisma.invoice.create({ data: { clientId, number, amountMinor, currency, status, issueDate, dueDate, fileKey, createdAt: now() }, select: { id: true } });
    } catch (error) {
      await deleteClientFile(fileKey);
      throw error;
    }
    if (status === "DUE") await safeNotify("CLIENT_INVOICE_DUE", clientId);
    await logAudit({ action: "create", category: "Content", entityType: "Invoice", entityId: invoice.id, entityLabel: number, after: { clientId, amountMinor, currency, status } });
    revalidateClient(clientId);
    return { success: true, id: invoice.id };
  } catch (error) {
    return failure(error, "Couldn't save the invoice");
  }
}

export async function setInvoiceStatus(invoiceId: string, status: InvoiceStatus): Promise<Result> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    if (!INVOICE_STATUSES.includes(status)) return { success: false, error: "Invalid status" };
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, clientId: true, number: true, status: true } });
    if (!inv) return { success: false, error: "Invoice not found" };
    await prisma.invoice.update({ where: { id: inv.id }, data: { status } });
    await logAudit({ action: "status", category: "Content", entityType: "Invoice", entityId: inv.id, entityLabel: inv.number, before: { status: inv.status }, after: { status } });
    revalidateClient(inv.clientId);
    return { success: true };
  } catch (error) {
    return failure(error, "Couldn't change the invoice");
  }
}

export async function deleteInvoice(invoiceId: string): Promise<Result> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, clientId: true, number: true, fileKey: true } });
    if (!inv) return { success: false, error: "Invoice not found" };
    await prisma.invoice.delete({ where: { id: inv.id } });
    await deleteClientFile(inv.fileKey);
    await logAudit({ action: "delete", category: "Content", entityType: "Invoice", entityId: inv.id, entityLabel: inv.number, before: { clientId: inv.clientId } });
    revalidateClient(inv.clientId);
    return { success: true };
  } catch (error) {
    return failure(error, "Couldn't delete the invoice");
  }
}

/** Adds a file to an existing invoice, or replaces its file (the old object is deleted after the row points at the new one). */
export async function attachInvoiceFile(fd: FormData): Promise<Result> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    const inv = await prisma.invoice.findUnique({ where: { id: str(fd, "invoiceId", 100) }, select: { id: true, clientId: true, number: true, fileKey: true } });
    if (!inv) return { success: false, error: "Invoice not found" };
    const upload = await checkUpload(fd.get("file"));
    if (!upload.ok) return { success: false, error: upload.error };
    const fileKey = await storeClientFile(inv.clientId, upload);
    try {
      await prisma.invoice.update({ where: { id: inv.id }, data: { fileKey } });
    } catch (error) {
      await deleteClientFile(fileKey);
      throw error;
    }
    await deleteClientFile(inv.fileKey);
    await logAudit({ action: "attach_file", category: "Content", entityType: "Invoice", entityId: inv.id, entityLabel: inv.number, after: { replaced: !!inv.fileKey } });
    revalidateClient(inv.clientId);
    return { success: true };
  } catch (error) {
    return failure(error, "Couldn't attach the file");
  }
}

// ---- quick-post (update with an optional attachment) ----

const UPDATE_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "WAITING_ON_CLIENT", "COMPLETED"] as const;

/**
 * The quick-post form: body, optional status change, optional file, notify
 * (on unless "false"). The file is checked and stored before the update is
 * created, its attachment row is written next, and the client is pushed
 * last, so a push never points at an update whose file isn't there yet. If
 * any step before the push fails, nothing is left behind.
 */
export async function postQuickUpdate(fd: FormData): Promise<Result<{ id: string }>> {
  try {
    const session = await requirePermission("CLIENT_UPDATES");
    const projectId = str(fd, "projectId", 100);
    const body = str(fd, "body", 2000);
    const internalNote = str(fd, "internalNote", 2000) || null;
    const statusRaw = str(fd, "status", 30);
    const notify = fd.get("notify") !== "false";
    if (!body) return { success: false, error: "Write the update first" };
    const status = statusRaw ? (UPDATE_STATUSES as readonly string[]).find((x) => x === statusRaw) : undefined;
    if (statusRaw && !status) return { success: false, error: "Invalid status" };
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, clientId: true, title: true, status: true } });
    if (!project) return { success: false, error: "Project not found" };

    const file = fd.get("file");
    let stored: { key: string; name: string } | null = null;
    if (file instanceof File && file.size > 0) {
      const upload = await checkUpload(file);
      if (!upload.ok) return { success: false, error: upload.error };
      stored = { key: await storeClientFile(project.clientId, upload), name: safeFileName(file.name) };
    }

    let update;
    try {
      update = await postManualUpdate(project, { authorId: session.user.id, body, internalNote, status, notify }, now(), stored ? async (updateId) => {
        await prisma.projectAttachment.create({ data: { updateId, name: stored.name, fileKey: stored.key }, select: { id: true } });
      } : undefined);
    } catch (error) {
      await deleteClientFile(stored?.key);
      throw error;
    }
    await logAudit({
      action: "post_update",
      category: "Content",
      entityType: "ProjectUpdate",
      entityId: update.id,
      entityLabel: project.title,
      after: { projectId, notify, attachment: stored?.name ?? null, ...(status && status !== project.status ? { status } : {}) },
    });
    revalidatePath(`/admin/clients/${project.clientId}/projects/${project.id}`);
    revalidatePath(`/admin/clients/${project.clientId}`);
    return { success: true, id: update.id };
  } catch (error) {
    return failure(error, "Couldn't post the update");
  }
}
