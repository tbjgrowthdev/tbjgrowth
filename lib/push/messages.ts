import type { StaffPushEvent } from "@/lib/push/recipients";
import type { ClientPushEvent } from "@/lib/push/client-notify";

export type PushMessage = { title: string; body: string; url: string };

// Fixed push copy. Deliberately generic: a lock screen must never show a
// client's name, email, phone or message. The url is the admin page the
// notification opens (login still required there).
export const PUSH_MESSAGES: Record<StaffPushEvent, PushMessage> = {
  NEW_LEAD: {
    title: "New lead received",
    body: "Open the admin panel to view it.",
    url: "/admin/leads",
  },
  NEW_BOOKING: {
    title: "New call booked",
    body: "A visitor booked a call. Open the admin panel for details.",
    url: "/admin/booking",
  },
  CONTENT_AWAITING_APPROVAL: {
    title: "Content awaiting approval",
    body: "New content was submitted for review.",
    url: "/admin/posts",
  },
};

// Client Hub push copy (TBJ Growth Tech app), English and Bangla by the
// client user's language. Generic on purpose: no names, amounts, invoice
// numbers or project titles ever reach a lock screen. Every url is a
// /portal path (checked with safePortalPath before sending).
export const CLIENT_PUSH_MESSAGES: Record<"en" | "bn", Record<ClientPushEvent, PushMessage>> = {
  en: {
    CLIENT_PROJECT_UPDATE: { title: "Project update", body: "There is a new update on your project.", url: "/portal/projects" },
    CLIENT_APPROVAL_NEEDED: { title: "Your approval is needed", body: "Open the app to review.", url: "/portal" },
    CLIENT_REPORT_READY: { title: "Report ready", body: "A new report is available.", url: "/portal/reports" },
    CLIENT_INVOICE_DUE: { title: "Invoice due", body: "You have an invoice to review.", url: "/portal/billing" },
    CLIENT_INVOICE_OVERDUE: { title: "Invoice overdue", body: "You have an invoice to review.", url: "/portal/billing" },
    CLIENT_MEETING_REMINDER: { title: "Meeting reminder", body: "You have an upcoming meeting.", url: "/portal/more" },
  },
  bn: {
    CLIENT_PROJECT_UPDATE: { title: "প্রজেক্ট আপডেট", body: "আপনার প্রজেক্টে নতুন আপডেট আছে।", url: "/portal/projects" },
    CLIENT_APPROVAL_NEEDED: { title: "আপনার অনুমোদন দরকার", body: "দেখতে অ্যাপটি খুলুন।", url: "/portal" },
    CLIENT_REPORT_READY: { title: "রিপোর্ট তৈরি", body: "নতুন একটি রিপোর্ট দেখা যাচ্ছে।", url: "/portal/reports" },
    CLIENT_INVOICE_DUE: { title: "ইনভয়েস বাকি", body: "আপনার একটি ইনভয়েস দেখার আছে।", url: "/portal/billing" },
    CLIENT_INVOICE_OVERDUE: { title: "ইনভয়েসের মেয়াদ পেরিয়েছে", body: "আপনার একটি ইনভয়েস দেখার আছে।", url: "/portal/billing" },
    CLIENT_MEETING_REMINDER: { title: "মিটিং মনে করিয়ে দেওয়া", body: "আপনার একটি মিটিং আসছে।", url: "/portal/more" },
  },
};

// Staff (TBJ Admin) push to one account manager when a client project has
// had no update within its interval. Generic like the rest: the project and
// client names are only in the email.
export const STALE_PROJECT_NUDGE: PushMessage = {
  title: "A client project needs an update",
  body: "Open Clients to post a quick update.",
  url: "/admin/clients",
};
