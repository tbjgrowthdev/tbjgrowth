"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendContactNotification } from "@/lib/email";
import { requirePermission, AuthError } from "@/lib/auth-guard";

const contactFormSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(320),
  phone: z.string().trim().max(50).optional().nullable(),
  company: z.string().trim().max(200).optional().nullable(),
  message: z.string().trim().min(1).max(5000),
  source: z.string().trim().max(100).optional().nullable(),
});

// Same-email submission cap in a rolling window — the one cheap, no-new-infra
// throttle available here (counts existing FormSubmission rows by createdAt,
// no new table or Cloudflare binding needed). This blunts scripted spam but
// isn't a substitute for IP-based rate limiting at the edge — see
// docs/runbooks/security.md for the Cloudflare-side rules this is meant to
// sit behind, not replace.
const SUBMIT_WINDOW_MS = 10 * 60 * 1000;
const SUBMIT_MAX_PER_WINDOW = 3;

// Public contact form — stays unguarded, but validated and throttled.
export async function submitContactForm(data: unknown) {
  try {
    const parsed = contactFormSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Please check the form for errors and try again." };
    }
    const input = parsed.data;

    const recentCount = await prisma.formSubmission.count({
      where: { email: input.email, createdAt: { gte: new Date(Date.now() - SUBMIT_WINDOW_MS) } },
    });
    if (recentCount >= SUBMIT_MAX_PER_WINDOW) {
      return { success: false, error: "Too many submissions from this email recently. Please try again later." };
    }

    const submission = await prisma.formSubmission.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        company: input.company || null,
        message: input.message,
        source: input.source || "Contact Page",
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
