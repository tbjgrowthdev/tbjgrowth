"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";

/**
 * Replaces all FAQ rows for a service in one go — simpler than diffing
 * individual add/edit/remove operations from the service form's local list state.
 */
export async function replaceServiceFaqs(
  serviceId: string,
  faqs: { question: string; answer: string }[]
) {
  try {
    await requirePermission("EDIT");
    const existing = await prisma.serviceFaq.findMany({
      where: { serviceId },
      orderBy: { order: "asc" },
      select: { question: true, answer: true },
    });
    await prisma.$transaction([
      prisma.serviceFaq.deleteMany({ where: { serviceId } }),
      ...(faqs.length > 0
        ? [
            prisma.serviceFaq.createMany({
              data: faqs.map((faq, index) => ({ ...faq, serviceId, order: index })),
            }),
          ]
        : []),
    ]);
    revalidatePath("/services/[slug]", "page");
    revalidatePath("/admin/services");
    await logAudit({
      action: "update",
      category: "Content",
      entityType: "ServiceFaq",
      entityId: serviceId,
      entityLabel: `${faqs.length} FAQs`,
      before: existing,
      after: faqs,
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to save FAQs for service ${serviceId}:`, error);
    return { success: false, error: error.message };
  }
}
