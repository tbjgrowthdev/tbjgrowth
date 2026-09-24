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
