"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { BRAND_NAME, sendContactNotification, sendLeadReply } from "@/lib/email";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";

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
// auth-check: public — public contact form; zod-validated and rate-limited per email
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
export async function getLeads(filter: "all" | "unanswered" | "answered" = "all") {
  try {
    await requirePermission("USER_MANAGEMENT");
    return await prisma.formSubmission.findMany({
      where: filter === "unanswered" ? { replies: { none: {} } } : filter === "answered" ? { replies: { some: {} } } : undefined,
      orderBy: { createdAt: "desc" },
      include: { replies: { orderBy: { createdAt: "asc" } } },
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

const replySchema = z.object({
  leadId: z.string().min(1).max(100),
  body: z.string().trim().min(1, "Write a reply first.").max(10000, "Replies are limited to 10,000 characters."),
});

// The same reply to the same lead within this window is treated as a
// double-click and not sent again.
const DUPLICATE_REPLY_WINDOW_MS = 2 * 60 * 1000;

const LEAD_REPLY_SUBJECT = `Re: Your message to ${BRAND_NAME}`;

/**
 * Emails a reply to a lead and saves it to the lead's history. Reply-To is the
 * Site Settings email, so the lead's answer reaches the normal inbox; without
 * one, nothing is sent. The email goes out first and is saved only once
 * Resend accepts it, so the history never lists a reply the lead didn't get.
 */
export async function replyToLead(data: unknown) {
  let session;
  try {
    session = await requirePermission("USER_MANAGEMENT");
  } catch (error) {
    if (error instanceof AuthError) return { success: false as const, error: error.message };
    throw error;
  }

  const parsed = replySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid reply" };
  }
  const { leadId, body } = parsed.data;

  try {
    const [lead, settings] = await Promise.all([
      prisma.formSubmission.findUnique({ where: { id: leadId } }),
      prisma.siteSetting.findFirst(),
    ]);
    if (!lead) return { success: false as const, error: "This lead no longer exists." };

    const inbox = settings?.email?.trim();
    if (!inbox) {
      return {
        success: false as const,
        error: "Set a contact email in Site Settings first. Replies use it as Reply-To, so the lead's answer reaches your inbox.",
      };
    }

    const duplicate = await prisma.leadReply.findFirst({
      where: { leadId, body, createdAt: { gte: new Date(Date.now() - DUPLICATE_REPLY_WINDOW_MS) } },
      select: { id: true },
    });
    if (duplicate) return { success: false as const, error: "This reply was already sent." };

    const senderName = session.user.name?.trim() || null;
    const sent = await sendLeadReply({
      to: lead.email,
      replyTo: inbox,
      subject: LEAD_REPLY_SUBJECT,
      body,
      senderName,
      original: { name: lead.name, message: lead.message, createdAt: lead.createdAt },
    });
    if (!sent.success) {
      return { success: false as const, error: sent.skipped ? sent.error ?? "Email sending isn't configured." : "The email couldn't be sent. Nothing was saved; please try again." };
    }

    // Separate single-row writes: the Neon HTTP adapter can't run a
    // transaction (docs/known-limitations.md).
    try {
      await prisma.leadReply.create({
        data: {
          leadId,
          toEmail: lead.email,
          subject: LEAD_REPLY_SUBJECT,
          body,
          sentById: session.user.id,
          sentByName: senderName,
          sentByEmail: session.user.email ?? null,
        },
      });
    } catch (error) {
      console.error("Lead reply was emailed but not saved:", error);
      revalidatePath("/admin/leads");
      return { success: true as const, warning: "The reply was emailed, but saving it to the history failed." };
    }
    if (!lead.isRead) {
      await prisma.formSubmission.update({ where: { id: leadId }, data: { isRead: true } }).catch((error) => {
        console.error("Failed to mark replied lead as read:", error);
      });
    }
    await logAudit({ action: "reply", category: "Users", entityType: "FormSubmission", entityId: leadId, entityLabel: lead.email });

    revalidatePath("/admin/leads");
    return { success: true as const };
  } catch (error) {
    console.error("Failed to reply to lead:", error);
    return { success: false as const, error: "Something went wrong. Please try again." };
  }
}
