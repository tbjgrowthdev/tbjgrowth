"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Replaces all FAQ rows for a service in one go — simpler than diffing
 * individual add/edit/remove operations from the service form's local list state.
 */
export async function replaceServiceFaqs(
  serviceId: string,
  faqs: { question: string; answer: string }[]
) {
  try {
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
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to save FAQs for service ${serviceId}:`, error);
    return { success: false, error: error.message };
  }
}
