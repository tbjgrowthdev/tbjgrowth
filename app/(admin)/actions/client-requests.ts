"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";

// Staff inbox for what clients send from the portal: requests
// (ClientRequest) and account-deletion requests (ClientUser.deletionRequestedAt).
// CLIENT_UPDATES: admins and editors handle it.

export async function getClientInbox() {
  try {
    await requirePermission("CLIENT_UPDATES");
    const [requests, deletions] = await Promise.all([
      prisma.clientRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, message: true, status: true, createdAt: true, client: { select: { id: true, name: true } }, clientUser: { select: { name: true, email: true } } },
      }),
      prisma.clientUser.findMany({
        where: { deletionRequestedAt: { not: null } },
        orderBy: { deletionRequestedAt: "desc" },
        select: { id: true, name: true, email: true, status: true, deletionRequestedAt: true, client: { select: { id: true, name: true } } },
      }),
    ]);
    return {
      requests: requests.map((r) => ({ id: r.id, message: r.message, status: r.status, createdAt: r.createdAt, clientId: r.client.id, clientName: r.client.name, userName: r.clientUser.name, userEmail: r.clientUser.email })),
      deletionRequests: deletions.map((u) => ({ id: u.id, name: u.name, email: u.email, status: u.status, requestedAt: u.deletionRequestedAt, clientId: u.client.id, clientName: u.client.name })),
    };
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("[client-requests] inbox failed:", error);
    return { requests: [], deletionRequests: [] };
  }
}

export async function setClientRequestStatus(id: string, status: "OPEN" | "DONE"): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission("CLIENT_UPDATES");
    if (status !== "OPEN" && status !== "DONE") return { success: false, error: "Invalid status" };
    const r = await prisma.clientRequest.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!r) return { success: false, error: "Request not found" };
    await prisma.clientRequest.update({ where: { id }, data: { status } });
    await logAudit({ action: "status", category: "Users", entityType: "ClientRequest", entityId: id, before: { status: r.status }, after: { status } });
    revalidatePath("/admin/clients/requests");
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("[client-requests] status failed:", error);
    return { success: false, error: "Couldn't change the request" };
  }
}
