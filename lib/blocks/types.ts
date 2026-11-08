// Client-safe block constants (no zod, no sanitize-html): the admin editor imports these, and must not pull the
// server-side validators into the browser bundle. The validators live in schema.ts and re-export these.

export const BLOCK_TYPES = ["hero", "richText", "cta", "cards", "testimonials", "faq", "pricing", "trustBadges", "leadForm"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === "string" && (BLOCK_TYPES as readonly string[]).includes(value);
}

/** Default (empty-but-valid-to-edit) data for a freshly added block of `type`. */
export function defaultBlockData(type: BlockType): Record<string, unknown> {
  switch (type) {
    case "hero": return { eyebrow: "", heading: "", subheading: "", primaryCtaLabel: "", primaryCtaHref: "", secondaryCtaLabel: "", secondaryCtaHref: "", imageUrl: "", imageAlt: "" };
    case "richText": return { html: "" };
    case "cta": return { heading: "", text: "", buttonLabel: "", buttonHref: "", secondaryLabel: "", secondaryHref: "" };
    case "cards": return { heading: "", intro: "", columns: 3, items: [{ title: "", text: "", href: "", linkLabel: "" }] };
    case "testimonials": return { heading: "", testimonialIds: [] };
    case "faq": return { heading: "Frequently asked questions", source: "custom", faqIds: [], items: [{ question: "", answer: "" }] };
    case "pricing": return { heading: "", intro: "", packageSlugs: [] };
    case "trustBadges": return { heading: "", items: [{ label: "", imageUrl: "", imageAlt: "" }] };
    case "leadForm": return { heading: "Get in touch", text: "", submitLabel: "Send", successMessage: "Thanks — we'll be in touch shortly.", showPhone: false, showCompany: false, showMessage: true };
  }
}
