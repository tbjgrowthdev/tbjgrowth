/**
 * Email sending via Resend's REST API (no SDK dependency — a simple authenticated fetch).
 * Requires RESEND_API_KEY. Falls back to logging (no throw) when unconfigured, so a
 * missing key never breaks the form submission it's attached to.
 */

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
  const from = process.env.RESEND_FROM_EMAIL || "TBJ Growth <onboarding@resend.dev>";

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

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [notifyEmail],
        reply_to: submission.email,
        subject: `New lead: ${submission.name}`,
        html,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend email failed:", res.status, errorText);
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to send contact notification email:", error);
    return { success: false, error };
  }
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
  const from = process.env.RESEND_FROM_EMAIL || "TBJ Growth <onboarding@resend.dev>";

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

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [notifyEmail],
        reply_to: booking.email,
        subject: `New booking: ${booking.name} — ${when}`,
        html,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend email failed:", res.status, errorText);
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to send booking notification email:", error);
    return { success: false, error };
  }
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
  const from = process.env.RESEND_FROM_EMAIL || "TBJ Growth <onboarding@resend.dev>";

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

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [failure.notifyEmail],
        subject: `⚠ Scheduled ${failure.jobType.toLowerCase()} failed — ${failure.willRetry ? "will retry" : "gave up"}`,
        html,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend email failed:", res.status, errorText);
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to send scheduled job failure email:", error);
    return { success: false, error };
  }
}

export async function sendAccountLockedNotification(params: { email: string; windowMinutes: number }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "TBJ Growth <onboarding@resend.dev>";

  if (!apiKey) {
    console.log("RESEND_API_KEY not set — skipping account-locked email for:", params.email);
    return { success: false, skipped: true };
  }

  const html = `
    <h2>Your admin account was temporarily locked</h2>
    <p>There were too many failed sign-in attempts for <strong>${escapeHtml(params.email)}</strong> in the last ${params.windowMinutes} minutes.</p>
    <p>Sign-ins for this account are blocked for ${params.windowMinutes} minutes from the most recent failed attempt. If this wasn't you, consider changing your password once you're back in.</p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [params.email],
        subject: "⚠ Your admin account was temporarily locked",
        html,
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend email failed:", res.status, errorText);
      return { success: false, error: errorText };
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to send account-locked email:", error);
    return { success: false, error };
  }
}

export async function sendErrorAlertNotification(params: {
  message: string;
  path: string | null;
  source: "server" | "client";
  notifyEmail?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "TBJ Growth <onboarding@resend.dev>";

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

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [params.notifyEmail],
        subject: `⚠ New error: ${params.message.slice(0, 80)}`,
        html,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend email failed:", res.status, errorText);
      return { success: false, error: errorText };
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to send error alert email:", error);
    return { success: false, error };
  }
}

export async function sendBackupAlertNotification(params: {
  success: boolean;
  verified: boolean;
  error: string | null;
  notifyEmail?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "TBJ Growth <onboarding@resend.dev>";

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

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [params.notifyEmail], subject, html }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend email failed:", res.status, errorText);
      return { success: false, error: errorText };
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to send backup alert email:", error);
    return { success: false, error };
  }
}

export async function sendUptimeAlertNotification(params: {
  recovered: boolean;
  statusCode: number | null;
  contentOk: boolean;
  error: string | null;
  notifyEmail?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "TBJ Growth <onboarding@resend.dev>";

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

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [params.notifyEmail], subject, html }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend email failed:", res.status, errorText);
      return { success: false, error: errorText };
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to send uptime alert email:", error);
    return { success: false, error };
  }
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
  const from = process.env.RESEND_FROM_EMAIL || "TBJ Growth <onboarding@resend.dev>";

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

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.notifyEmail],
        subject: `⚠ Link Monitor: ${params.findingCount} issue${params.findingCount > 1 ? "s" : ""} found`,
        html,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend email failed:", res.status, errorText);
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to send link check notification email:", error);
    return { success: false, error };
  }
}

export async function sendSeoAuditNotification(params: {
  findingCount: number;
  categoryCounts: Record<string, number>;
  notifyEmail?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "TBJ Growth <onboarding@resend.dev>";

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

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.notifyEmail],
        subject: `⚠ Automated SEO Audit: ${params.findingCount} issue${params.findingCount > 1 ? "s" : ""} found`,
        html,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend email failed:", res.status, errorText);
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to send SEO audit notification email:", error);
    return { success: false, error };
  }
}

/** Generic plain-text notification — used by the automation engine's NOTIFY_TEAM action, whose message varies by event/rule and so has no dedicated template like the other functions above. Throws (rather than returning {success:false}) so the caller records it as a failed step, same contract as postSlackMessage/sendWebhookEvent. */
export async function sendAutomationNotification(subject: string, message: string, notifyEmail: string | null | undefined): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "TBJ Growth <onboarding@resend.dev>";
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  if (!notifyEmail) throw new Error("No notification email configured in Site Settings");

  const html = `<p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [notifyEmail], subject, html }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Resend email failed: ${res.status} ${errorText}`);
  }
}
