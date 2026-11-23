import prisma from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { fileError, serveClientFile } from "@/lib/portal/files";

// Staff download of any client file (drafts included):
// /api/admin/client-files/{id}?kind=report|invoice|attachment. Needs
// CLIENT_MANAGEMENT. /api is outside middleware.ts, so this checks itself.
export const dynamic = "force-dynamic";

async function lookup(kind: string, id: string): Promise<{ fileKey: string; name: string } | null> {
  if (kind === "report") {
    const r = await prisma.report.findUnique({ where: { id }, select: { fileKey: true, period: true } });
    return r?.fileKey ? { fileKey: r.fileKey, name: `report-${r.period}` } : null;
  }
  if (kind === "invoice") {
    const i = await prisma.invoice.findUnique({ where: { id }, select: { fileKey: true, number: true } });
    return i?.fileKey ? { fileKey: i.fileKey, name: `invoice-${i.number}` } : null;
  }
  if (kind === "attachment") {
    const a = await prisma.projectAttachment.findUnique({ where: { id }, select: { fileKey: true, name: true } });
    return a ? { fileKey: a.fileKey, name: a.name } : null;
  }
  return null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
  } catch (error) {
    if (error instanceof AuthError) {
      const missingPermission = error.message.startsWith("Missing required permission");
      return missingPermission ? fileError(403, "You don't have access to client files.") : fileError(401, "Please sign in again.");
    }
    throw error;
  }
  const { id } = await params;
  const kind = new URL(request.url).searchParams.get("kind") ?? "";
  const file = await lookup(kind, id);
  if (!file) return fileError(404, "File not found");
  return serveClientFile(file.fileKey, file.name);
}
