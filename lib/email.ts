/**
 * Email sending via Resend's REST API (no SDK dependency — a simple authenticated fetch).
 * Requires RESEND_API_KEY. Falls back to logging (no throw) when unconfigured, so a
 * missing key never breaks the form submission it's attached to.
 *
 * Every send funnels through deliverResendEmail below, which records the
 * outcome to EmailLog — the "failed email" signal for the Observability
 * dashboard. Before this, a failed send was only a console.error with no
 * durable record.
 */

import prisma from "@/lib/prisma";

// Awaited by its callers (not fire-and-forget) — a Cloudflare Workers
// invocation isn't guaranteed to keep running an un-awaited promise after
// the response it belongs to is sent, same reasoning as lib/prisma.ts's
// slow-query logger. A failure here must never surface as a failure of
// the email send it's recording, so it's swallowed after logging.
async function logEmailAttempt(type: string, to: string, success: boolean, error: string | null) {
  try {
    await prisma.emailLog.create({ data: { type, to, success, error } });
  } catch (err) {
    console.error("Failed to write EmailLog:", err);
  }
}

type ResendSendResult = { success: boolean; skipped?: true; error?: string };

const DEFAULT_FROM = "TBJ Growth <onboarding@resend.dev>";
export const BRAND_NAME = "TBJ Growth";

/**
 * "Name <addr>" (or a bare "addr") with its display name replaced. The name
 * is quoted, and quotes, angle brackets, backslashes and line breaks are
 * removed from it, so an admin's name can't break or add header fields.
 */
export function withDisplayName(from: string, name: string): string {
  const address = from.match(/<([^>]+)>/)?.[1]?.trim() ?? from.trim();
  const safe = name.replace(/[\r\n]+/g, " ").replace(/["<>\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 100);
  return safe ? `"${safe}" <${address}>` : address;
}

/** The one place that actually calls Resend — every exported function below builds its subject/html and calls this. */
async function deliverResendEmail(params: {
  type: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Overrides the display name of RESEND_FROM_EMAIL; the address stays the same. */
  fromName?: string;
}): Promise<ResendSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const configuredFrom = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
  const from = params.fromName ? withDisplayName(configuredFrom, params.fromName) : configuredFrom;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [params.to],
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
        subject: params.subject,
        html: params.html,
        ...(params.text ? { text: params.text } : {}),
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend email failed:", res.status, errorText);
      await logEmailAttempt(params.type, params.to, false, errorText);
      return { success: false, error: errorText };
    }

    await logEmailAttempt(params.type, params.to, true, null);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to send ${params.type} email:`, error);
    await logEmailAttempt(params.type, params.to, false, message);
    return { success: false, error: message };
  }
}

export type BatchEmail = { to: string; subject: string; html: string; text: string; headers?: Record<string, string> };
export type BatchSendResult =
  | { success: true }
  | { success: false; error: string; status: number | null; retryable: boolean; alreadySent: boolean };

/**
 * Sends up to 100 separate emails in one Resend call (POST /emails/batch);
 * each recipient gets their own message, so no address sees another. Resend
 * treats an idempotencyKey it has seen in the last 24h as the same request
 * and doesn't send again, so retrying a batch after a crash can't double-send.
 * Logged to EmailLog as one row per batch.
 */
export async function sendResendBatch(params: { type: string; emails: BatchEmail[]; idempotencyKey: string; fromName?: string }): Promise<BatchSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const logTo = `${params.emails.length} recipient(s)`;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY is not set", status: null, retryable: true, alreadySent: false };
  }
  const configuredFrom = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
  const from = params.fromName ? withDisplayName(configuredFrom, params.fromName) : configuredFrom;

  try {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": params.idempotencyKey },
      body: JSON.stringify(
        params.emails.map((e) => ({ from, to: [e.to], subject: e.subject, html: e.html, text: e.text, ...(e.headers ? { headers: e.headers } : {}) })),
      ),
    });
    if (res.ok) {
      await logEmailAttempt(params.type, logTo, true, null);
      return { success: true };
    }
    const errorText = await res.text();
    console.error("Resend batch failed:", res.status, errorText);
    await logEmailAttempt(params.type, logTo, false, errorText);
    // 409 invalid_idempotent_request: this key was already used for a batch
    // with different content (a subscriber left between attempts). That
    // batch went out, so it counts as sent.
    const alreadySent = res.status === 409 && errorText.includes("invalid_idempotent_request");
    return { success: false, error: errorText, status: res.status, retryable: res.status === 429 || res.status === 409 || res.status >= 500, alreadySent };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to send ${params.type} batch:`, error);
    await logEmailAttempt(params.type, logTo, false, message);
    return { success: false, error: message, status: null, retryable: true, alreadySent: false };
  }
}

export type PostAnnouncement = {
  title: string;
  excerpt: string | null;
  imageUrl: string | null; // absolute
  postUrl: string; // absolute
  siteUrl: string; // absolute
};

/** The new-post email for one recipient. Exported for tests and the admin test send. */
export function buildPostAnnouncementEmail(post: PostAnnouncement, unsubscribeUrl: string, opts: { test?: boolean } = {}) {
  const subject = `${opts.test ? "[Test] " : ""}${post.title}`;
  const excerpt = post.excerpt?.trim() || null;
  const testNote = opts.test ? "<p style=\"margin:0 0 16px;padding:8px 12px;background:#fef3c7;color:#92400e;font-size:13px;border-radius:6px\">Test email: only you received it, and the unsubscribe link below doesn't change anything.</p>" : "";
  const html = `
    <div style="background:#f5f5f4;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
        ${post.imageUrl ? `<img src="${escapeHtml(post.imageUrl)}" alt="" width="560" style="display:block;width:100%;height:auto"/>` : ""}
        <div style="padding:28px 28px 24px;color:#1f2937">
          ${testNote}
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#c2410c;font-weight:bold">New on the ${BRAND_NAME} blog</p>
          <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3">${escapeHtml(post.title)}</h1>
          ${excerpt ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563">${escapeHtml(excerpt)}</p>` : ""}
          <a href="${escapeHtml(post.postUrl)}" style="display:inline-block;padding:12px 22px;background:#c2410c;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:bold;font-size:15px">Read the article</a>
        </div>
      </div>
      <p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#78716c;text-align:center">
        You're getting this because you subscribed to the ${BRAND_NAME} newsletter at <a href="${escapeHtml(post.siteUrl)}" style="color:#78716c">${escapeHtml(post.siteUrl.replace(/^https?:\/\//, ""))}</a>.<br/>
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:#78716c">Unsubscribe</a>
      </p>
    </div>
  `;
  const text = [
    opts.test ? "[Test email: only you received it, and the unsubscribe link doesn't change anything.]\n" : null,
    `New on the ${BRAND_NAME} blog`,
    "",
    post.title,
    excerpt ? `\n${excerpt}` : null,
    "",
    `Read the article: ${post.postUrl}`,
    "",
    "--",
    `You're getting this because you subscribed to the ${BRAND_NAME} newsletter.`,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].filter((l) => l !== null).join("\n");
  // RFC 8058 one-click unsubscribe; Gmail and Yahoo require it for bulk mail.
  const headers = { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
  return { subject, html, text, headers };
}

export async function getEmailLogHistory(limit = 50) {
  return prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

type ContactSubmission = {
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  message: string;
  source?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendContactNotification(submission: ContactSubmission, notifyEmail: string | null | undefined) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log("RESEND_API_KEY not set — skipping email notification for lead:", submission.email);
    return { success: false, skipped: true };
  }
  if (!notifyEmail) {
    console.log("No notification email configured in Site Settings — skipping email for lead:", submission.email);
    return { success: false, skipped: true };
  }

  const html = `
    <h2>New contact form submission</h2>
    <p><strong>Name:</strong> ${escapeHtml(submission.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(submission.email)}</p>
    ${submission.phone ? `<p><strong>Phone:</strong> ${escapeHtml(submission.phone)}</p>` : ""}
    ${submission.company ? `<p><strong>Company:</strong> ${escapeHtml(submission.company)}</p>` : ""}
    <p><strong>Source:</strong> ${escapeHtml(submission.source || "Contact Page")}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(submission.message).replace(/\n/g, "<br/>")}</p>
  `;

  return deliverResendEmail({ type: "contact", to: notifyEmail, replyTo: submission.email, subject: `New lead: ${submission.name}`, html });
}

export type LeadReplyEmail = {
  to: string;
  replyTo: string; // the site's inbox (Site Settings email), so the lead's answer lands there
  subject: string;
  body: string; // plain text typed by the admin
  senderName: string | null; // admin's name; null signs as the team
  original: { name: string; message: string; createdAt: Date };
};

/** Builds the reply email: the admin's text, a signature, then the lead's message quoted. Exported for tests. */
export function buildLeadReplyEmail(reply: LeadReplyEmail) {
  const signer = reply.senderName?.trim() || null;
  const signature = signer ? `${signer}\n${BRAND_NAME}` : `The ${BRAND_NAME} team`;
  const when = reply.original.createdAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC";
  const attribution = `On ${when}, ${reply.original.name} wrote:`;
  const nl2br = (s: string) => escapeHtml(s).replace(/\r?\n/g, "<br/>");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2937">
      <p>${nl2br(reply.body)}</p>
      <p>${nl2br(signature)}</p>
      <p style="margin-top:24px;color:#6b7280;font-size:13px">${escapeHtml(attribution)}</p>
      <blockquote style="margin:0;padding-left:12px;border-left:3px solid #d1d5db;color:#6b7280;font-size:13px">${nl2br(reply.original.message)}</blockquote>
    </div>
  `;
  const quoted = reply.original.message.split(/\r?\n/).map((line) => `> ${line}`).join("\n");
  const text = `${reply.body}\n\n${signature}\n\n${attribution}\n${quoted}\n`;
  const fromName = signer ? `${signer} at ${BRAND_NAME}` : BRAND_NAME;
  return { html, text, fromName };
}

/** Emails an admin's reply to a lead. Never throws; a missing RESEND_API_KEY is reported as skipped. */
export async function sendLeadReply(reply: LeadReplyEmail): Promise<ResendSendResult> {
  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY not set — can't send lead reply to:", reply.to);
    return { success: false, skipped: true, error: "Email sending isn't configured (RESEND_API_KEY is not set)." };
  }
  const { html, text, fromName } = buildLeadReplyEmail(reply);
  return deliverResendEmail({ type: "lead-reply", to: reply.to, replyTo: reply.replyTo, subject: reply.subject, html, text, fromName });
}

type BookingNotification = {
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  message?: string | null;
  startsAt: Date;
  duration: number;
};

export async function sendBookingNotification(booking: BookingNotification, notifyEmail: string | null | undefined) {
  const apiKey = process.env.RESEND_API_KEY;

  const when = booking.startsAt.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!apiKey) {
    console.log("RESEND_API_KEY not set — skipping email notification for booking:", booking.email);
    return { success: false, skipped: true };
  }
  if (!notifyEmail) {
    console.log("No notification email configured in Site Settings — skipping email for booking:", booking.email);
    return { success: false, skipped: true };
  }

  const html = `
    <h2>New conversation booked</h2>
    <p><strong>When:</strong> ${escapeHtml(when)} (${booking.duration} min)</p>
    <p><strong>Name:</strong> ${escapeHtml(booking.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(booking.email)}</p>
    ${booking.phone ? `<p><strong>Phone:</strong> ${escapeHtml(booking.phone)}</p>` : ""}
    ${booking.company ? `<p><strong>Company:</strong> ${escapeHtml(booking.company)}</p>` : ""}
    ${booking.message ? `<p><strong>Message:</strong></p><p>${escapeHtml(booking.message).replace(/\n/g, "<br/>")}</p>` : ""}
  `;

  return deliverResendEmail({ type: "booking", to: notifyEmail, replyTo: booking.email, subject: `New booking: ${booking.name} — ${when}`, html });
}

type ScheduledJobFailure = {
  contentType: string;
  contentId: string;
  jobType: string;
  attempt: number;
  maxAttempts: number;
  willRetry: boolean;
  error: string;
  notifyEmail?: string | null;
};

export async function sendScheduledJobFailureNotification(failure: ScheduledJobFailure) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log("RESEND_API_KEY not set — skipping scheduled job failure email:", failure);
    return { success: false, skipped: true };
  }
  if (!failure.notifyEmail) {
    console.log("No recipient for scheduled job failure email — skipping:", failure);
    return { success: false, skipped: true };
  }

  const statusLine = failure.willRetry
    ? `This will be retried automatically (attempt ${failure.attempt} of ${failure.maxAttempts}).`
    : `This has now failed ${failure.maxAttempts} times and will NOT be retried automatically — it needs manual attention.`;

  const html = `
    <h2>Scheduled ${escapeHtml(failure.jobType.toLowerCase())} failed</h2>
    <p><strong>Content:</strong> ${escapeHtml(failure.contentType)} (${escapeHtml(failure.contentId)})</p>
    <p><strong>Attempt:</strong> ${failure.attempt} of ${failure.maxAttempts}</p>
    <p>${escapeHtml(statusLine)}</p>
    <p><strong>Error:</strong></p>
    <pre style="background:#f4f4f4;padding:12px;border-radius:6px;white-space:pre-wrap;">${escapeHtml(failure.error)}</pre>
  `;

  return deliverResendEmail({
    type: "scheduled-job-failure",
    to: failure.notifyEmail,
    subject: `⚠ Scheduled ${failure.jobType.toLowerCase()} failed — ${failure.willRetry ? "will retry" : "gave up"}`,
    html,
  });
}

export async function sendAccountLockedNotification(params: { email: string; windowMinutes: number }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log("RESEND_API_KEY not set — skipping account-locked email for:", params.email);
    return { success: false, skipped: true };
  }

  const html = `
    <h2>Your admin account was temporarily locked</h2>
    <p>There were too many failed sign-in attempts for <strong>${escapeHtml(params.email)}</strong> in the last ${params.windowMinutes} minutes.</p>
    <p>Sign-ins for this account are blocked for ${params.windowMinutes} minutes from the most recent failed attempt. If this wasn't you, consider changing your password once you're back in.</p>
  `;

  return deliverResendEmail({ type: "account-locked", to: params.email, subject: "⚠ Your admin account was temporarily locked", html });
}

export async function sendErrorAlertNotification(params: {
  message: string;
  path: string | null;
  source: "server" | "client";
  notifyEmail?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log("RESEND_API_KEY not set — skipping error alert email:", params.message);
    return { success: false, skipped: true };
  }
  if (!params.notifyEmail) {
    console.log("No notification email configured in Site Settings — skipping error alert email");
    return { success: false, skipped: true };
  }

  const html = `
    <h2>New ${escapeHtml(params.source)}-side error</h2>
    ${params.path ? `<p><strong>Path:</strong> <code>${escapeHtml(params.path)}</code></p>` : ""}
    <p><strong>Message:</strong></p>
    <pre style="background:#f4f4f4;padding:12px;border-radius:6px;white-space:pre-wrap;">${escapeHtml(params.message)}</pre>
    <p>Repeat occurrences of the same error won't trigger another email for 30 minutes — check the Monitoring tab in admin for the full log.</p>
  `;

  return deliverResendEmail({ type: "error-alert", to: params.notifyEmail, subject: `⚠ New error: ${params.message.slice(0, 80)}`, html });
}

export async function sendBackupAlertNotification(params: {
  success: boolean;
  verified: boolean;
  error: string | null;
  notifyEmail?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log("RESEND_API_KEY not set — skipping backup alert email");
    return { success: false, skipped: true };
  }
  if (!params.notifyEmail) {
    console.log("No notification email configured in Site Settings — skipping backup alert email");
    return { success: false, skipped: true };
  }

  const subject = !params.success
    ? "⚠ Database backup FAILED"
    : "⚠ Database backup succeeded but restore verification failed";

  const html = `
    <h2>${escapeHtml(subject)}</h2>
    ${params.error ? `<pre style="background:#f4f4f4;padding:12px;border-radius:6px;white-space:pre-wrap;">${escapeHtml(params.error)}</pre>` : ""}
    <p>See the Monitoring tab in admin, or the "Database Backup" GitHub Actions run, for full logs.</p>
  `;

  return deliverResendEmail({ type: "backup-alert", to: params.notifyEmail, subject, html });
}

export async function sendUptimeAlertNotification(params: {
  recovered: boolean;
  statusCode: number | null;
  contentOk: boolean;
  error: string | null;
  notifyEmail?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log("RESEND_API_KEY not set — skipping uptime alert email");
    return { success: false, skipped: true };
  }
  if (!params.notifyEmail) {
    console.log("No notification email configured in Site Settings — skipping uptime alert email");
    return { success: false, skipped: true };
  }

  const subject = params.recovered ? "✅ Site is back up" : "🔴 Site is DOWN or serving degraded content";
  const html = `
    <h2>${escapeHtml(subject)}</h2>
    ${params.statusCode ? `<p><strong>Status code:</strong> ${params.statusCode}</p>` : ""}
    <p><strong>Content check:</strong> ${params.contentOk ? "passed" : "failed (page served but looked empty/degraded)"}</p>
    ${params.error ? `<pre style="background:#f4f4f4;padding:12px;border-radius:6px;white-space:pre-wrap;">${escapeHtml(params.error)}</pre>` : ""}
  `;

  return deliverResendEmail({ type: "uptime-alert", to: params.notifyEmail, subject, html });
}

type LinkCheckFindingSummary = {
  category: string;
  path: string;
  status?: number | string;
  description?: string;
};

export async function sendLinkCheckNotification(params: {
  findingCount: number;
  findings: LinkCheckFindingSummary[];
  notifyEmail?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log("RESEND_API_KEY not set — skipping link check notification email");
    return { success: false, skipped: true };
  }
  if (!params.notifyEmail) {
    console.log("No notification email configured in Site Settings — skipping link check email");
    return { success: false, skipped: true };
  }

  const rows = params.findings
    .map(
      (f) =>
        `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(f.category)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;font-family:monospace;">${escapeHtml(f.path)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(String(f.status ?? f.description ?? ""))}</td></tr>`
    )
    .join("");

  const html = `
    <h2>Link Monitor found ${params.findingCount} issue${params.findingCount > 1 ? "s" : ""}</h2>
    <table style="border-collapse:collapse;width:100%;">
      <thead><tr><th style="text-align:left;padding:4px 8px;">Category</th><th style="text-align:left;padding:4px 8px;">Path</th><th style="text-align:left;padding:4px 8px;">Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${params.findingCount > params.findings.length ? `<p>...and ${params.findingCount - params.findings.length} more. See the Link Monitor in the admin dashboard for the full list.</p>` : ""}
  `;

  return deliverResendEmail({
    type: "link-check",
    to: params.notifyEmail,
    subject: `⚠ Link Monitor: ${params.findingCount} issue${params.findingCount > 1 ? "s" : ""} found`,
    html,
  });
}

export async function sendSeoAuditNotification(params: {
  findingCount: number;
  categoryCounts: Record<string, number>;
  notifyEmail?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log("RESEND_API_KEY not set — skipping SEO audit notification email");
    return { success: false, skipped: true };
  }
  if (!params.notifyEmail) {
    console.log("No notification email configured in Site Settings — skipping SEO audit email");
    return { success: false, skipped: true };
  }

  const rows = Object.entries(params.categoryCounts)
    .filter(([, count]) => count > 0)
    .map(
      ([category, count]) =>
        `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(category)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;">${count}</td></tr>`
    )
    .join("");

  const html = `
    <h2>Automated SEO Audit found ${params.findingCount} issue${params.findingCount > 1 ? "s" : ""}</h2>
    <table style="border-collapse:collapse;width:100%;">
      <thead><tr><th style="text-align:left;padding:4px 8px;">Category</th><th style="text-align:left;padding:4px 8px;">Count</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p>See Automated SEO Audits in the admin dashboard for the full findings list.</p>
  `;

  return deliverResendEmail({
    type: "seo-audit",
    to: params.notifyEmail,
    subject: `⚠ Automated SEO Audit: ${params.findingCount} issue${params.findingCount > 1 ? "s" : ""} found`,
    html,
  });
}

/** Generic plain-text notification — used by the automation engine's NOTIFY_TEAM action, whose message varies by event/rule and so has no dedicated template like the other functions above. Throws (rather than returning {success:false}) so the caller records it as a failed step, same contract as postSlackMessage/sendWebhookEvent. */
export async function sendAutomationNotification(subject: string, message: string, notifyEmail: string | null | undefined): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  if (!notifyEmail) throw new Error("No notification email configured in Site Settings");

  const html = `<p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`;
  const result = await deliverResendEmail({ type: "automation", to: notifyEmail, subject, html });
  if (!result.success) throw new Error(`Resend email failed: ${result.error}`);
}

// ---------------------------------------------------------------------------
// Client Hub (/portal). Never throw: a mail problem must not change what the
// sign-in form shows (lib/portal/auth.ts relies on identical responses).

type ClientLang = "en" | "bn";

const CLIENT_CODE_COPY: Record<ClientLang, { subject: string; heading: string; body: string; footer: string }> = {
  en: {
    subject: "Your TBJ Growth Tech sign-in code",
    heading: "Your sign-in code",
    body: "Enter this code in the TBJ Growth Tech app or at the client portal. It works once and expires in 10 minutes. If you got more than one code, use the newest.",
    footer: "If you didn't ask for this code, you can ignore this email.",
  },
  bn: {
    subject: "আপনার TBJ Growth Tech সাইন-ইন কোড",
    heading: "আপনার সাইন-ইন কোড",
    body: "কোডটি TBJ Growth Tech অ্যাপে বা ক্লায়েন্ট পোর্টালে লিখুন। এটা একবারই কাজ করবে, মেয়াদ ১০ মিনিট। একাধিক কোড পেলে সবচেয়ে নতুনটি ব্যবহার করুন।",
    footer: "আপনি এই কোড না চেয়ে থাকলে ইমেইলটি উপেক্ষা করুন।",
  },
};

function clientCodeBlock(code: string) {
  return `<p style="font-size:32px;letter-spacing:8px;font-weight:700;font-family:monospace;margin:16px 0">${escapeHtml(code)}</p>`;
}

/** The 6-digit sign-in code. The code is the only secret in the email. */
export async function sendClientLoginCode(params: { to: string; code: string; name?: string | null; language?: ClientLang }) {
  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY not set — skipping client sign-in code email.");
    return { success: false, skipped: true };
  }
  const copy = CLIENT_CODE_COPY[params.language === "bn" ? "bn" : "en"];
  const html = `
    <h2>${copy.heading}</h2>
    <p>${copy.body}</p>
    ${clientCodeBlock(params.code)}
    <p style="color:#6b7280;font-size:13px">${copy.footer}</p>
  `;
  const text = `${copy.heading}: ${params.code}\n\n${copy.body}\n\n${copy.footer}\n`;
  return deliverResendEmail({ type: "client-login-code", to: params.to, subject: copy.subject, html, text, fromName: BRAND_NAME });
}

/** Staff invited a client user: link to the portal plus a first sign-in code. */
export async function sendClientInvite(params: { to: string; name: string; code: string; portalUrl: string; language?: ClientLang }) {
  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY not set — skipping client invite email.");
    return { success: false, skipped: true };
  }
  const bn = params.language === "bn";
  const url = escapeHtml(params.portalUrl);
  const subject = bn ? "TBJ Growth Tech ক্লায়েন্ট পোর্টালে আমন্ত্রণ" : "You're invited to the TBJ Growth Tech client portal";
  const introFor = (name: string) =>
    bn
      ? `${name}, আপনার প্রজেক্টের অগ্রগতি, রিপোর্ট ও ইনভয়েস এখন এক জায়গায় দেখতে পারবেন।`
      : `Hi ${name}, you can now follow your project, reports and invoices in one place.`;
  const plainName = params.name.replace(/[\r\n]+/g, " ").slice(0, 100);
  const step = bn ? "পোর্টাল খুলে আপনার ইমেইল দিন, তারপর এই কোডটি লিখুন (মেয়াদ ১০ মিনিট):" : "Open the portal, enter your email, then this code (valid for 10 minutes):";
  const later = bn ? "একাধিক কোড পেলে সবচেয়ে নতুনটি ব্যবহার করুন। পরে আবার ঢুকতে চাইলে পোর্টাল থেকেই নতুন কোড চাইতে পারবেন।" : "If you get more than one code, use the newest. Next time, just ask for a new code from the portal.";
  const html = `
    <h2>${subject}</h2>
    <p>${escapeHtml(introFor(plainName))}</p>
    <p><a href="${url}">${url}</a></p>
    <p>${step}</p>
    ${clientCodeBlock(params.code)}
    <p style="color:#6b7280;font-size:13px">${later}</p>
  `;
  const text = `${subject}\n\n${introFor(plainName)}\n\n${params.portalUrl}\n\n${step} ${params.code}\n\n${later}\n`;
  return deliverResendEmail({ type: "client-invite", to: params.to, subject, html, text, fromName: BRAND_NAME });
}
