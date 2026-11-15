"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { withinIpAndGlobalLimits } from "@/lib/rate-limit";
import { isNewsletterSource, newsletterSignupSchema, subscribersToCsv, SUBSCRIBERS_PAGE_SIZE } from "@/lib/newsletter";
import type { NewsletterStatus, Prisma } from "@/lib/generated/prisma/client";

const ADMIN_PATH = "/admin/subscribers";

type SignupResult = { success: true } | { success: false; error: string };

// Public newsletter signup, used by components/NewsletterForm.tsx. Spam and
// abuse protection, cheapest check first:
//   1. Next.js refuses Server Action calls whose Origin doesn't match the host.
//   2. Honeypot field: a filled-in one is dropped, but still answers "success"
//      so the bot can't tell.
//   3. Cloudflare rate-limit bindings (wrangler.jsonc): per IP, plus an
//      overall cap. No limiting under `next dev`.
//   4. zod validation; the address is lowercased, so the unique index on
//      email catches duplicates however they're typed.
// A duplicate also answers "success", so the form can't be used to check
// whether an address is on the list.
// auth-check: public — public newsletter signup; zod-validated, honeypot, rate-limited per IP and globally
export async function subscribeToNewsletter(data: unknown): Promise<SignupResult> {
  const parsed = newsletterSignupSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "invalid" };
  }
  const input = parsed.data;

  if (input.website) return { success: true };

  if (!(await withinIpAndGlobalLimits({ headers: await headers() }, "NEWSLETTER_IP_LIMITER", "NEWSLETTER_GLOBAL_LIMITER"))) {
    return { success: false, error: "rate_limited" };
  }

  try {
    // One statement, so it works on the Neon HTTP adapter. A repeat signup
    // reactivates the row and records the form it came from this time; the
    // original createdAt is kept.
    await prisma.newsletterSubscriber.upsert({
      where: { email: input.email },
      create: {
        email: input.email,
        source: input.source,
        path: input.path || null,
        locale: input.locale || null,
      },
      update: {
        status: "ACTIVE",
        unsubscribedAt: null,
        source: input.source,
        path: input.path || null,
        locale: input.locale || null,
      },
    });
  } catch (error) {
    // Two signups for the same new address at once: the loser hits the
    // unique index, and the address is on the list either way.
    if ((error as { code?: string })?.code === "P2002") return { success: true };
    console.error("Failed to save newsletter subscriber:", error);
    return { success: false, error: "failed" };
  }

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

// --- Admin -----------------------------------------------------------------
// Subscriber emails are PII, so these use the same USER_MANAGEMENT gate as
// /admin/leads (see app/(admin)/actions/forms.ts).

export type SubscriberFilters = { source?: string; status?: string; page?: number };

function toWhere(filters: SubscriberFilters): Prisma.NewsletterSubscriberWhereInput {
  const where: Prisma.NewsletterSubscriberWhereInput = {};
  if (isNewsletterSource(filters.source)) where.source = filters.source;
  if (filters.status === "ACTIVE" || filters.status === "UNSUBSCRIBED") where.status = filters.status;
  return where;
}

export async function getSubscribers(filters: SubscriberFilters = {}) {
  await requirePermission("USER_MANAGEMENT");
  const where = toWhere(filters);
  const page = Math.max(1, Math.floor(filters.page ?? 1));

  const [subscribers, matching, grouped] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * SUBSCRIBERS_PAGE_SIZE,
      take: SUBSCRIBERS_PAGE_SIZE,
    }),
    prisma.newsletterSubscriber.count({ where }),
    prisma.newsletterSubscriber.groupBy({ by: ["source", "status"], _count: { _all: true } }),
  ]);

  // Counts for the summary cards, over the whole list (not the filter).
  const counts = { active: 0, unsubscribed: 0, activeBySource: {} as Record<string, number> };
  for (const g of grouped) {
    const n = g._count._all;
    if (g.status === "ACTIVE") {
      counts.active += n;
      counts.activeBySource[g.source] = (counts.activeBySource[g.source] ?? 0) + n;
    } else {
      counts.unsubscribed += n;
    }
  }

  return { subscribers, matching, page, pageSize: SUBSCRIBERS_PAGE_SIZE, counts };
}

/** CSV of every subscriber matching the filters (no paging). */
export async function exportSubscribersCsv(filters: SubscriberFilters = {}) {
  try {
    await requirePermission("USER_MANAGEMENT");
    const rows = await prisma.newsletterSubscriber.findMany({ where: toWhere(filters), orderBy: { createdAt: "desc" } });
    return { success: true as const, data: subscribersToCsv(rows), count: rows.length };
  } catch (error) {
    if (error instanceof AuthError) return { success: false as const, error: error.message };
    console.error("Failed to export subscribers:", error);
    return { success: false as const, error: "Export failed" };
  }
}

export async function setSubscriberStatus(id: string, status: NewsletterStatus) {
  try {
    await requirePermission("USER_MANAGEMENT");
    if (status !== "ACTIVE" && status !== "UNSUBSCRIBED") return { success: false, error: "Invalid status" };
    const updated = await prisma.newsletterSubscriber.update({
      where: { id },
      data: { status, unsubscribedAt: status === "UNSUBSCRIBED" ? new Date() : null },
    });
    await logAudit({
      action: status === "UNSUBSCRIBED" ? "unsubscribe" : "resubscribe",
      category: "Users",
      entityType: "NewsletterSubscriber",
      entityId: id,
      entityLabel: updated.email,
      after: { status },
    });
    revalidatePath(ADMIN_PATH);
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to update subscriber:", error);
    return { success: false, error: "Couldn't update subscriber" };
  }
}

export async function deleteSubscriber(id: string) {
  try {
    await requirePermission("USER_MANAGEMENT");
    const deleted = await prisma.newsletterSubscriber.delete({ where: { id } });
    await logAudit({
      action: "delete",
      category: "Users",
      entityType: "NewsletterSubscriber",
      entityId: id,
      entityLabel: deleted.email,
      before: { email: deleted.email, source: deleted.source, status: deleted.status },
    });
    revalidatePath(ADMIN_PATH);
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to delete subscriber:", error);
    return { success: false, error: "Couldn't delete subscriber" };
  }
}
