"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";

export async function getPartners() {
  try {
    await requireSession();
    return await prisma.trustedPartner.findMany({
      orderBy: { order: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch partners:", error);
    return [];
  }
}

export async function getPartner(id: string) {
  try {
    await requireSession();
    return await prisma.trustedPartner.findUnique({
      where: { id },
    });
  } catch (error) {
    console.error(`Failed to fetch partner ${id}:`, error);
    return null;
  }
}

export async function createPartner(data: any) {
  try {
    await requirePermission("CREATE");
    const partner = await prisma.trustedPartner.create({
      data,
    });
    revalidatePath("/");
    revalidatePath("/admin/partners");
    await logAudit({
      action: "create",
      category: "Content",
      entityType: "TrustedPartner",
      entityId: partner.id,
      entityLabel: partner.name,
      after: partner,
    });
    return { success: true, partner };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create partner:", error);
    return { success: false, error: error.message };
  }
}

export async function updatePartner(id: string, data: any) {
  try {
    await requirePermission("EDIT");
    const before = await prisma.trustedPartner.findUnique({ where: { id } });
    const partner = await prisma.trustedPartner.update({
      where: { id },
      data,
    });
    revalidatePath("/");
    revalidatePath("/admin/partners");
    await logAudit({
      action: "update",
      category: "Content",
      entityType: "TrustedPartner",
      entityId: partner.id,
      entityLabel: partner.name,
      before,
      after: partner,
    });
    return { success: true, partner };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to update partner ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function deletePartner(id: string) {
  try {
    await requirePermission("DELETE");
    const before = await prisma.trustedPartner.findUnique({ where: { id } });
    await prisma.trustedPartner.delete({
      where: { id },
    });
    revalidatePath("/");
    revalidatePath("/admin/partners");
    await logAudit({
      action: "delete",
      category: "Content",
      entityType: "TrustedPartner",
      entityId: id,
      entityLabel: before?.name,
      before,
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to delete partner ${id}:`, error);
    return { success: false, error: error.message };
  }
}
