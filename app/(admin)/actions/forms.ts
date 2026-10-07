"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendContactNotification } from "@/lib/email";
import { requirePermission, AuthError } from "@/lib/auth-guard";

// Public contact form — stays unguarded.
export async function submitContactForm(data: any) {
  try {
    const submission = await prisma.formSubmission.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        message: data.message,
        source: data.source || "Contact Page",
      },
    });

    const settings = await prisma.siteSetting.findFirst();
    await sendContactNotification(submission, settings?.email);

    revalidatePath("/admin/leads");
    return { success: true };
  } catch (error) {
    console.error("Failed to submit form:", error);
    return { success: false, error: "Failed to submit form" };
  }
}

// Leads carry customer PII (name, email, phone, message) — gated behind
// USER_MANAGEMENT since that's the one permission scoped to exactly
// ADMIN/SUPER_ADMIN in lib/permissions.ts, matching middleware's existing
// grouping of /admin/leads with /admin/settings and /admin/admins.
export async function getLeads() {
  try {
    await requirePermission("USER_MANAGEMENT");
    return await prisma.formSubmission.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch leads:", error);
    return [];
  }
}

export async function markLeadAsRead(id: string) {
  try {
    await requirePermission("USER_MANAGEMENT");
    await prisma.formSubmission.update({
      where: { id },
      data: { isRead: true },
    });
    revalidatePath("/admin/leads");
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    return { success: false };
  }
}
