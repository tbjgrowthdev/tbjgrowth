"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";

/**
 * Replaces all FAQ rows for a location in one go — simpler than diffing
 * individual add/edit/remove operations from the location form's local
 * list state. Same pattern as replaceServiceFaqs.
 */
export async function replaceLocationFaqs(locationId: string, faqs: { question: string; answer: string }[]) {
  try {
    await requirePermission("EDIT");
    const existing = await prisma.locationFaq.findMany({
      where: { locationId },
      orderBy: { order: "asc" },
      select: { question: true, answer: true },
    });
    // Not createMany(), and not a $transaction() array — the HTTP-based Neon
    // adapter (see lib/prisma.ts) rejects both createMany and any
    // $transaction array with more than one operation in it. deleteMany on
    // its own is a single statement and works fine; the creates that follow
    // just can't share a transaction with it or with each other.
    await prisma.locationFaq.deleteMany({ where: { locationId } });
    await Promise.all(faqs.map((faq, index) => prisma.locationFaq.create({ data: { ...faq, locationId, order: index } })));
    revalidatePath("/locations/[slug]", "page");
    revalidatePath("/admin/locations");
    await logAudit({
      action: "update",
      category: "Content",
      entityType: "LocationFaq",
      entityId: locationId,
      entityLabel: `${faqs.length} FAQs`,
      before: existing,
      after: faqs,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to save FAQs for location ${locationId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to save FAQs" };
  }
}
