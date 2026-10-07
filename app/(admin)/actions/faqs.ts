"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";

// getFaqs is consumed by the public homepage FAQ section — stays unguarded.
export async function getFaqs() {
  try {
    return await prisma.faq.findMany({
      orderBy: { order: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch FAQs:", error);
    return [];
  }
}

export async function getFaq(id: string) {
  try {
    await requireSession();
    return await prisma.faq.findUnique({
      where: { id },
    });
  } catch (error) {
    console.error(`Failed to fetch FAQ ${id}:`, error);
    return null;
  }
}

export async function createFaq(data: any) {
  try {
    await requirePermission("CREATE");
    const faq = await prisma.faq.create({
      data,
    });
    revalidatePath("/");
    revalidatePath("/admin/faqs");
    await logAudit({
      action: "create",
      category: "Content",
      entityType: "Faq",
      entityId: faq.id,
      entityLabel: faq.question,
      after: faq,
    });
    return { success: true, faq };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create FAQ:", error);
    return { success: false, error: error.message };
  }
}

export async function updateFaq(id: string, data: any) {
  try {
    await requirePermission("EDIT");
    const before = await prisma.faq.findUnique({ where: { id } });
    const faq = await prisma.faq.update({
      where: { id },
      data,
    });
    revalidatePath("/");
    revalidatePath("/admin/faqs");
    await logAudit({
      action: "update",
      category: "Content",
      entityType: "Faq",
      entityId: faq.id,
      entityLabel: faq.question,
      before,
      after: faq,
    });
    return { success: true, faq };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to update FAQ ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function deleteFaq(id: string) {
  try {
    await requirePermission("DELETE");
    const before = await prisma.faq.findUnique({ where: { id } });
    await prisma.faq.delete({
      where: { id },
    });
    revalidatePath("/");
    revalidatePath("/admin/faqs");
    await logAudit({
      action: "delete",
      category: "Content",
      entityType: "Faq",
      entityId: id,
      entityLabel: before?.question,
      before,
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to delete FAQ ${id}:`, error);
    return { success: false, error: error.message };
  }
}
