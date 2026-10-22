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
    // Not createMany(), and not a $transaction() array — the HTTP-based Neon
    // adapter (see lib/prisma.ts) rejects both createMany and any
    // $transaction array with more than one operation in it. deleteMany on
    // its own is a single statement and works fine; the creates that follow
    // just can't share a transaction with it or with each other.
    await prisma.serviceFaq.deleteMany({ where: { serviceId } });
    await Promise.all(faqs.map((faq, index) => prisma.serviceFaq.create({ data: { ...faq, serviceId, order: index } })));
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
