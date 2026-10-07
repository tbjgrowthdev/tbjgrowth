"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";

function testimonialSnapshot(t: any) {
  return { clientName: t.clientName, role: t.role, company: t.company, industry: t.industry, rating: t.rating, order: t.order };
}

// Consumed by the public Testimonials component — stays unguarded.
export async function getTestimonials() {
  try {
    return await prisma.testimonial.findMany({
      orderBy: { order: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch testimonials:", error);
    return [];
  }
}

export async function getTestimonial(id: string) {
  try {
    await requireSession();
    return await prisma.testimonial.findUnique({
      where: { id },
    });
  } catch (error) {
    console.error(`Failed to fetch testimonial ${id}:`, error);
    return null;
  }
}

export async function createTestimonial(data: any) {
  try {
    await requirePermission("CREATE");
    const testimonial = await prisma.testimonial.create({
      data,
    });
    revalidatePath("/");
    revalidatePath("/about");
    revalidatePath("/admin/testimonials");
    await logAudit({
      action: "create",
      category: "Content",
      entityType: "Testimonial",
      entityId: testimonial.id,
      entityLabel: testimonial.clientName,
      after: testimonialSnapshot(testimonial),
    });
    return { success: true, testimonial };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create testimonial:", error);
    return { success: false, error: error.message };
  }
}

export async function updateTestimonial(id: string, data: any) {
  try {
    await requirePermission("EDIT");
    const existing = await prisma.testimonial.findUnique({ where: { id } });
    const testimonial = await prisma.testimonial.update({
      where: { id },
      data,
    });
    revalidatePath("/");
    revalidatePath("/about");
    revalidatePath("/admin/testimonials");
    await logAudit({
      action: "update",
      category: "Content",
      entityType: "Testimonial",
      entityId: testimonial.id,
      entityLabel: testimonial.clientName,
      before: existing && testimonialSnapshot(existing),
      after: testimonialSnapshot(testimonial),
    });
    return { success: true, testimonial };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to update testimonial ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function deleteTestimonial(id: string) {
  try {
    await requirePermission("DELETE");
    const before = await prisma.testimonial.findUnique({ where: { id } });
    await prisma.testimonial.delete({
      where: { id },
    });
    revalidatePath("/");
    revalidatePath("/about");
    revalidatePath("/admin/testimonials");
    await logAudit({
      action: "delete",
      category: "Content",
      entityType: "Testimonial",
      entityId: id,
      entityLabel: before?.clientName,
      before: before && testimonialSnapshot(before),
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to delete testimonial ${id}:`, error);
    return { success: false, error: error.message };
  }
}
