import { after } from "next/server";
import prisma from "@/lib/prisma";
import { BRAND_NAME, buildPostAnnouncementEmail, sendResendBatch, type PostAnnouncement } from "@/lib/email";
import { PUBLIC_PATH_BUILDERS } from "@/lib/sitemap";
import { siteBaseUrl, unsubscribeUrl } from "@/lib/newsletter-unsubscribe";

// Emails newsletter subscribers about a newly published blog post.
//
// When: a post's first-ever publish (manual, lib/workflow.ts, or scheduled,
// lib/scheduled-jobs.ts) while SiteSetting.newsletterAutoSend is on. The
// callers check "first-ever" (publishedAt was null); the unique postId on
// NewsletterCampaign is the backstop, so a post can never be queued twice.
//
// How: queuePostNewsletter only creates the campaign row. Sending happens in
// processNewsletterCampaigns, in batches of up to 100 (one Resend batch call
// each), right after the publish response (next/server `after`) and again
// on every run of /api/cron/scheduled-jobs (every 5 minutes) until done. A
// run sends at most MAX_BATCHES_PER_RUN batches, to stay inside a Worker
// invocation's subrequest and time limits.
//
// Never twice per person: subscribers are sent in id order and the campaign
// saves the last id sent (cursor) after each batch. A batch whose send went
// out but whose cursor update was lost is resent with the same Resend
// Idempotency-Key, which Resend doesn't deliver again. A lock (lockedUntil)
// stops two runs from sending the same campaign at once.

export const BATCH_SIZE = 100;
export const MAX_BATCHES_PER_RUN = 8;
const LOCK_MS = 3 * 60 * 1000;
export const MAX_ATTEMPTS = 5;

type PostForCampaign = { id: string; title: string; slug: string };

function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${siteBaseUrl()}${url}`;
  return null;
}

export function postAnnouncement(post: { title: string; slug: string; excerpt: string | null; featuredImage: string | null }): PostAnnouncement {
  const base = siteBaseUrl();
  return {
    title: post.title,
    excerpt: post.excerpt,
    imageUrl: absoluteUrl(post.featuredImage),
    postUrl: `${base}${PUBLIC_PATH_BUILDERS.POST(post.slug)}`,
    siteUrl: base,
  };
}

/**
 * Called on a post's first-ever publish. Creates its campaign if the switch is
 * on and starts sending after the response. Never throws: a newsletter
 * problem must never fail the publish.
 */
export async function queuePostNewsletter(post: PostForCampaign): Promise<"queued" | "off" | "exists" | "error"> {
  try {
    const settings = await prisma.siteSetting.findFirst({ select: { newsletterAutoSend: true } });
    if (!settings?.newsletterAutoSend) return "off";

    try {
      await prisma.newsletterCampaign.create({ data: { postId: post.id, postTitle: post.title, postSlug: post.slug } });
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") return "exists";
      throw error;
    }

    try {
      after(() => processNewsletterCampaigns().catch((error) => console.error("Newsletter send failed:", error)));
    } catch {
      // Outside a request (a script): the cron run picks it up instead.
    }
    return "queued";
  } catch (error) {
    console.error(`Failed to queue newsletter for post ${post.id}:`, error);
    return "error";
  }
}

type RunSummary = { campaigns: number; batches: number; sent: number; skipped?: "off" };

/** Sends pending campaigns, oldest first, up to MAX_BATCHES_PER_RUN batches in total. */
export async function processNewsletterCampaigns(maxBatches = MAX_BATCHES_PER_RUN): Promise<RunSummary> {
  const summary: RunSummary = { campaigns: 0, batches: 0, sent: 0 };
  const settings = await prisma.siteSetting.findFirst({ select: { newsletterAutoSend: true } });
  // Turning the switch off also cancels running campaigns (see
  // setNewsletterAutoSend); this check covers a run already in progress.
  if (!settings?.newsletterAutoSend) return { ...summary, skipped: "off" };

  const campaigns = await prisma.newsletterCampaign.findMany({ where: { status: "SENDING" }, orderBy: { createdAt: "asc" }, take: 5 });
  for (const campaign of campaigns) {
    if (summary.batches >= maxBatches) break;
    summary.campaigns++;
    const result = await runCampaign(campaign.id, maxBatches - summary.batches);
    summary.batches += result.batches;
    summary.sent += result.sent;
  }
  return summary;
}

async function claim(id: string): Promise<boolean> {
  const now = new Date();
  try {
    // One conditional UPDATE: it matches only if nobody holds the lock, so
    // exactly one concurrent run wins.
    await prisma.newsletterCampaign.update({
      where: { id, status: "SENDING", OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
      data: { lockedUntil: new Date(now.getTime() + LOCK_MS) },
    });
    return true;
  } catch (error) {
    if ((error as { code?: string })?.code === "P2025") return false;
    throw error;
  }
}

async function runCampaign(id: string, batchBudget: number): Promise<{ batches: number; sent: number }> {
  let batches = 0;
  let sent = 0;
  if (!(await claim(id))) return { batches, sent };

  const release = (data: Record<string, unknown> = {}) =>
    prisma.newsletterCampaign.update({ where: { id }, data: { lockedUntil: null, ...data } });

  try {
    const campaign = await prisma.newsletterCampaign.findUnique({ where: { id } });
    if (!campaign) return { batches, sent };

    const post = await prisma.post.findUnique({
      where: { id: campaign.postId },
      select: { title: true, slug: true, excerpt: true, featuredImage: true, status: true },
    });
    if (!post || post.status !== "PUBLISHED") {
      // Deleted or taken down before everyone was emailed: stop, rather than
      // send people to a page that isn't live.
      await release({ status: "CANCELLED", completedAt: new Date(), lastError: post ? "Post was unpublished before sending finished" : "Post was deleted" });
      return { batches, sent };
    }
    const announcement = postAnnouncement(post);
    let cursor = campaign.cursor;
    let attempts = campaign.attempts;

    while (batches < batchBudget) {
      const recipients = await prisma.newsletterSubscriber.findMany({
        where: { status: "ACTIVE", createdAt: { lte: campaign.cutoff }, ...(cursor ? { id: { gt: cursor } } : {}) },
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
        select: { id: true, email: true },
      });
      if (recipients.length === 0) {
        await release({ status: "SENT", completedAt: new Date(), cursor });
        return { batches, sent };
      }

      const result = await sendResendBatch({
        type: "newsletter",
        fromName: BRAND_NAME,
        idempotencyKey: `newsletter-${campaign.id}-${recipients[0].id}`,
        emails: recipients.map((r) => ({ to: r.email, ...buildPostAnnouncementEmail(announcement, unsubscribeUrl(r.id)) })),
      });
      batches++;

      if (result.success || result.alreadySent) {
        cursor = recipients[recipients.length - 1].id;
        attempts = 0;
        sent += result.success ? recipients.length : 0;
        await prisma.newsletterCampaign.update({
          where: { id },
          data: { cursor, attempts: 0, lastError: null, sentCount: { increment: result.success ? recipients.length : 0 } },
        });
        continue;
      }

      attempts++;
      const failed = !result.retryable || attempts >= MAX_ATTEMPTS;
      await release({
        attempts,
        lastError: result.error.slice(0, 2000),
        ...(failed ? { status: "FAILED", completedAt: new Date() } : {}),
      });
      return { batches, sent };
    }

    await release();
    return { batches, sent };
  } catch (error) {
    console.error(`Newsletter campaign ${id} failed:`, error);
    await release({ lastError: error instanceof Error ? error.message : String(error) }).catch(() => {});
    return { batches, sent };
  }
}
