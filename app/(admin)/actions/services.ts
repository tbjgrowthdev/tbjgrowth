"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";

function serviceSnapshot(service: any) {
  return {
    title: service.title,
    slug: service.slug,
    subtitle: service.subtitle,
    isIndexable: service.isIndexable,
    metaTitle: service.metaTitle,
    metaDescription: service.metaDescription,
    order: service.order,
  };
}

// getServices / getServiceBySlug are consumed by public service pages — stay unguarded.
export async function getServices() {
  try {
    return await prisma.agencyService.findMany({
      orderBy: { order: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return [];
  }
}

export async function getService(id: string) {
  try {
    await requireSession();
    return await prisma.agencyService.findUnique({
      where: { id },
      include: { faqs: { orderBy: { order: "asc" } } },
    });
  } catch (error) {
    console.error(`Failed to fetch service ${id}:`, error);
    return null;
  }
}

export async function getServiceBySlug(slug: string) {
  try {
    return await prisma.agencyService.findUnique({
      where: { slug },
      include: { faqs: { orderBy: { order: "asc" } } },
    });
  } catch (error) {
    console.error(`Failed to fetch service with slug ${slug}:`, error);
    return null;
  }
}

export async function createService(data: any) {
  try {
    await requirePermission("CREATE");
    const service = await prisma.agencyService.create({
      data,
    });
    revalidatePath("/");
    revalidatePath("/services");
    revalidatePath("/services/[slug]", "page");
    revalidatePath("/admin/services");
    await logAudit({
      action: "create",
      category: "Content",
      entityType: "AgencyService",
      entityId: service.id,
      entityLabel: service.title,
      after: serviceSnapshot(service),
    });
    return { success: true, service };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create service:", error);
    return { success: false, error: error.message };
  }
}

export async function updateService(id: string, data: any) {
  try {
    await requirePermission("EDIT");
    const before = await prisma.agencyService.findUnique({ where: { id } });
    const service = await prisma.agencyService.update({
      where: { id },
      data,
    });
    revalidatePath("/");
    revalidatePath("/services");
    revalidatePath("/services/[slug]", "page");
    revalidatePath("/admin/services");
    await logAudit({
      action: "update",
      category: "Content",
      entityType: "AgencyService",
      entityId: service.id,
      entityLabel: service.title,
      before: before ? serviceSnapshot(before) : undefined,
      after: serviceSnapshot(service),
    });
    return { success: true, service };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to update service ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function deleteService(id: string) {
  try {
    await requirePermission("DELETE");
    const before = await prisma.agencyService.findUnique({ where: { id } });
    await prisma.agencyService.delete({
      where: { id },
    });
    revalidatePath("/");
    revalidatePath("/services");
    revalidatePath("/admin/services");
    await logAudit({
      action: "delete",
      category: "Content",
      entityType: "AgencyService",
      entityId: id,
      entityLabel: before?.title,
      before: before ? serviceSnapshot(before) : undefined,
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to delete service ${id}:`, error);
    return { success: false, error: error.message };
  }
}
