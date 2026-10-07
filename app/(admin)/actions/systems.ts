"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";

function systemSnapshot(system: any) {
  return {
    title: system.title,
    subtitle: system.subtitle,
    iconName: system.iconName,
    status: system.status,
    progress: system.progress,
    tagline: system.tagline,
  };
}

// Consumed by the public TBJSystems homepage component — stays unguarded.
export async function getSystems() {
  try {
    return await prisma.tBJSystem.findMany({
      orderBy: { order: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch systems:", error);
    return [];
  }
}

export async function getSystem(id: string) {
  try {
    await requireSession();
    return await prisma.tBJSystem.findUnique({
      where: { id },
    });
  } catch (error) {
    console.error(`Failed to fetch system ${id}:`, error);
    return null;
  }
}

export async function createSystem(data: any) {
  try {
    await requirePermission("CREATE");
    const system = await prisma.tBJSystem.create({
      data,
    });
    revalidatePath("/");
    revalidatePath("/admin/systems");
    await logAudit({
      action: "create",
      category: "Content",
      entityType: "TBJSystem",
      entityId: system.id,
      entityLabel: system.title,
      after: systemSnapshot(system),
    });
    return { success: true, system };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create system:", error);
    return { success: false, error: error.message };
  }
}

export async function updateSystem(id: string, data: any) {
  try {
    await requirePermission("EDIT");
    const existing = await prisma.tBJSystem.findUnique({ where: { id } });
    const system = await prisma.tBJSystem.update({
      where: { id },
      data,
    });
    revalidatePath("/");
    revalidatePath("/admin/systems");
    await logAudit({
      action: "update",
      category: "Content",
      entityType: "TBJSystem",
      entityId: system.id,
      entityLabel: system.title,
      before: existing && systemSnapshot(existing),
      after: systemSnapshot(system),
    });
    return { success: true, system };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to update system ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function deleteSystem(id: string) {
  try {
    await requirePermission("DELETE");
    const before = await prisma.tBJSystem.findUnique({ where: { id } });
    await prisma.tBJSystem.delete({
      where: { id },
    });
    revalidatePath("/");
    revalidatePath("/admin/systems");
    await logAudit({
      action: "delete",
      category: "Content",
      entityType: "TBJSystem",
      entityId: id,
      entityLabel: before?.title,
      before: before && systemSnapshot(before),
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to delete system ${id}:`, error);
    return { success: false, error: error.message };
  }
}
