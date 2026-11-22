import type { StaffPushEvent } from "@/lib/push/recipients";

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
