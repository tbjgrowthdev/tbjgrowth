// Pure constants shared by server code (brand-kb.ts, lib/content-pipeline/
// prompts.ts) and client components (BrandKbEditor.tsx) — zero imports of
// prisma/auth-guard/audit-log, same reason lib/content-pipeline/
// prompt-constants.ts is split out from prompt-library.ts: a "use client"
// component importing server-only code fails the Next.js build outright.
import type { BrandSectionKey } from "@/lib/generated/prisma/client";

export const BRAND_SECTION_KEYS: BrandSectionKey[] = [
  "BRAND_VOICE",
  "AUDIENCE",
  "SERVICES",
  "PRODUCTS",
  "USPS",
  "TERMINOLOGY",
  "FORBIDDEN_TERMS",
  "CTA_RULES",
  "EXAMPLES",
  "GUIDELINES",
];

// FORBIDDEN_TERMS and CTA_RULES are phrased as imperatives rather than
// neutral labels — this text is what actually appears in the AI's system
// prompt (see lib/brand-kb/context.ts), so the label itself is part of
// how strongly the model treats the section, not just a UI caption.
export const SECTION_LABEL: Record<BrandSectionKey, string> = {
  BRAND_VOICE: "Brand voice",
  AUDIENCE: "Target audience",
  SERVICES: "Services",
  PRODUCTS: "Products",
  USPS: "Unique selling points",
  TERMINOLOGY: "Preferred terminology",
  FORBIDDEN_TERMS: "NEVER use these terms or phrases",
  CTA_RULES: "Call-to-action rules (must follow)",
  EXAMPLES: "Example on-brand content",
  GUIDELINES: "Brand guidelines",
};

export const SECTION_HELP: Record<BrandSectionKey, string> = {
  BRAND_VOICE: "How the brand sounds — tone, personality, sentence style. E.g. \"Confident, direct, no corporate jargon.\"",
  AUDIENCE: "Who this is written for — role, company size/stage, what they care about.",
  SERVICES: "What the agency/company actually does, in plain terms.",
  PRODUCTS: "Named products/offerings, if any, and what they are.",
  USPS: "What makes this different from competitors — the real differentiators.",
  TERMINOLOGY: "Preferred words/phrases for recurring concepts (e.g. \"clients\" not \"customers\").",
  FORBIDDEN_TERMS: "One term or phrase per line. Checked for real in the QA stage, not just asked of the model.",
  CTA_RULES: "Rules every call-to-action must follow (e.g. always link to /book-a-call, never \"click here\").",
  EXAMPLES: "A short passage of genuinely on-brand copy the model can pattern-match against.",
  GUIDELINES: "Anything else — formatting conventions, compliance notes, things to always/never do.",
};
