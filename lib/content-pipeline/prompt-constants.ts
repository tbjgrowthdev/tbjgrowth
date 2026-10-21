// Pure constants/helpers shared by both server code (prompt-library.ts,
// prompts.ts) and client components (PromptEditor.tsx). Kept in a separate
// file with zero imports of prisma/auth-guard/audit-log — prompt-library.ts
// pulls those in, and a "use client" component importing it directly
// would bundle server-only code (next/headers etc.) into the client
// build, which Next.js's build refuses outright.
import type { PromptCategory } from "@/lib/generated/prisma/client";

export const PROMPT_CATEGORIES: PromptCategory[] = ["BLOG", "CASE_STUDY", "SERVICE", "LANDING_PAGE", "SEO", "SOCIAL", "IMAGE", "REFRESH"];

// The only categories a live pipeline stage actually reads today (see
// resolvePrompt()'s callers in prompts.ts, and lib/automation/prompts.ts
// for SOCIAL). The rest are real, usable library entries with no consumer
// yet — not placeholders to delete, just authored ahead of the feature
// that will read them. IMAGE feeds the Image stage's generation prompt
// (style/subject guidance), not an alt-text instruction — alt text is
// always a plain accessibility description, never admin-templated.
export const WIRED_CATEGORIES: PromptCategory[] = ["BLOG", "CASE_STUDY", "SEO", "IMAGE", "REFRESH", "SOCIAL"];

export const CATEGORY_LABEL: Record<PromptCategory, string> = {
  BLOG: "Blog",
  CASE_STUDY: "Case Study",
  SERVICE: "Service",
  LANDING_PAGE: "Landing Page",
  SEO: "SEO",
  SOCIAL: "Social",
  IMAGE: "Image",
  REFRESH: "Refresh",
};

const DRAFT_RULES_DEFAULT = `Formatting rules (strict):
- Output semantic HTML body content only: <h2>, <h3>, <p>, <ul>/<ol>/<li>, <strong>, <em>, <blockquote> as needed. No <h1> (the page title is rendered separately), no <html>/<body>/<head> wrapper.
- Do NOT include any <a> tags or links — internal links are added in a later pipeline stage.
- Do NOT include any images.
- Write complete, substantive paragraphs (this is the real published draft, not a stub) — aim for 900-1500 words total.
- Never invent specific statistics, named sources, or client results that weren't given in the brief.`;

// Single source of truth for each category's hardcoded fallback — used by
// prompts.ts when no PromptTemplate has been authored yet (so nothing
// changes until an admin actually edits one), and by the "create first
// version" form as its starting text, so an edit begins from working
// copy instead of a blank box. Categories with no entry here (SERVICE,
// LANDING_PAGE) have no equivalent hardcoded prompt to seed from, since no
// stage generates them yet — their form just starts empty.
export const DEFAULT_BODY_TEMPLATE: Partial<Record<PromptCategory, string>> = {
  BLOG: DRAFT_RULES_DEFAULT,
  CASE_STUDY: DRAFT_RULES_DEFAULT,
  SEO: "Write SEO metadata for this published content.",
  IMAGE: "Photorealistic, professional, natural lighting, no embedded text or watermarks — suitable as a blog featured image.",
  REFRESH: "Update the content to be current and accurate, fix anything outdated, and improve it for the keyword it's meant to rank for — keep the same structure and voice unless the detected signals clearly call for a bigger change.",
  SOCIAL: "Write a short LinkedIn post and a short X/Twitter post announcing this content. Match the brand voice. Never invent a statistic, quote, or result that isn't already in the content.",
};

/**
 * Simple {{var}} substitution — intentionally not a full templating
 * engine. The point is that someone editing these in the admin UI is
 * thinking in terms of "the topic goes here," not writing code; an
 * unmatched {{placeholder}} is left as-is rather than throwing, so a typo
 * degrades to visible-but-harmless text instead of a failed pipeline stage.
 */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => vars[key] ?? match);
}
