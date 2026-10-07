"use server";

import prisma from "@/lib/prisma";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import type { AuditCategory } from "@/lib/audit-log";

// Audit logs can reveal system-wide activity across every user, so viewing
// is scoped the same as Leads/team settings: USER_MANAGEMENT, i.e.
// ADMIN/SUPER_ADMIN only — not Editors/SEO Managers/Contributors, even
// though they can trigger entries.
export async function getAuditLogs(filters?: { category?: AuditCategory; entityType?: string; userId?: string; limit?: number }) {
  try {
    await requirePermission("USER_MANAGEMENT");
    return await prisma.auditLog.findMany({
      where: {
        category: filters?.category,
        entityType: filters?.entityType,
        userId: filters?.userId,
      },
      orderBy: { createdAt: "desc" },
      take: filters?.limit ?? 200,
    });
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return [];
  }
}

// Deliberately NO updateAuditLog — entries are immutable once written.
//
// Deletion is restricted to SUPER_ADMIN, not just USER_MANAGEMENT (which
// ADMIN also holds) — the user explicitly asked that a normal Admin cannot
// delete or edit the audit trail, only the Super Admin, since an Admin
// being able to erase the record of their own actions would defeat the
// point of the log.
export async function deleteAuditLog(id: string) {
  try {
    const session = await requireSession();
    if (session.user.role !== "SUPER_ADMIN") {
      return { success: false, error: "Only the Super Admin can delete audit log entries" };
    }
    await prisma.auditLog.delete({ where: { id } });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to delete audit log ${id}:`, error);
    return { success: false, error: error.message };
  }
}

// Bulk retention purge — same SUPER_ADMIN-only restriction as a single delete.
export async function purgeAuditLogsBefore(beforeDate: string) {
  try {
    const session = await requireSession();
    if (session.user.role !== "SUPER_ADMIN") {
      return { success: false, error: "Only the Super Admin can purge audit log entries" };
    }
    const result = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: new Date(beforeDate) } },
    });
    return { success: true, count: result.count };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to purge audit logs:", error);
    return { success: false, error: error.message };
  }
}
