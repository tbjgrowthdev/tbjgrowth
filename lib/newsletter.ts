import { z } from "zod";
import { rowsToCsv } from "@/lib/csv";

// Shared by the public signup action, the admin page and the tests. No
// server-only imports, so the form component can use the source list too.

/** The forms that can add a subscriber. Add a value here to add a new form. */
export const NEWSLETTER_SOURCES = ["footer", "blog"] as const;
export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];

export const NEWSLETTER_SOURCE_LABELS: Record<NewsletterSource, string> = {
  footer: "Footer",
  blog: "Blog page",
};

/** Rows per page on /admin/subscribers. */
export const SUBSCRIBERS_PAGE_SIZE = 100;

export function isNewsletterSource(value: unknown): value is NewsletterSource {
  return typeof value === "string" && (NEWSLETTER_SOURCES as readonly string[]).includes(value);
}

export const newsletterSignupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  source: z.enum(NEWSLETTER_SOURCES),
  path: z.string().trim().max(300).startsWith("/").optional().nullable(),
  locale: z.string().trim().max(10).optional().nullable(),
  // Honeypot: hidden from people, so only bots fill it in.
  website: z.string().max(500).optional().nullable(),
});

export type NewsletterSignup = z.infer<typeof newsletterSignupSchema>;

/**
 * Spreadsheet apps run a cell starting with = + - @ (or tab/CR) as a formula.
 * Emails can legally start with + or -, so prefix those with a quote on export.
 */
function neutralizeFormula(value: string | null | undefined): string {
  if (!value) return "";
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

type ExportRow = {
  email: string;
  source: string;
  status: string;
  path: string | null;
  locale: string | null;
  createdAt: Date;
  unsubscribedAt: Date | null;
};

export function subscribersToCsv(rows: ExportRow[]): string {
  return rowsToCsv(
    ["email", "source", "status", "page", "locale", "subscribed_at", "unsubscribed_at"],
    rows.map((r) => ({
      email: neutralizeFormula(r.email),
      source: r.source,
      status: r.status,
      page: neutralizeFormula(r.path),
      locale: r.locale ?? "",
      subscribed_at: r.createdAt.toISOString(),
      unsubscribed_at: r.unsubscribedAt?.toISOString() ?? "",
    })),
  );
}
