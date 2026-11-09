// Client-safe block constants (no zod, no sanitize-html): the admin editor imports these, and must not pull the
// server-side validators into the browser bundle. The validators live in schema.ts and re-export these.

export const BLOCK_TYPES = ["hero", "richText", "cta", "cards", "testimonials", "faq", "pricing", "trustBadges", "leadForm",
  // Case-study blocks (usable on any page).
  "metricHero", "factsStrip", "dataTable", "proofGallery", "pullQuote", "takeaway"] as const;
/** Max blocks in one layout. Lives here (client-safe) so the import dialog can enforce it too. */
export const MAX_BLOCKS_PER_PAGE = 60;
export type BlockType = (typeof BLOCK_TYPES)[number];

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === "string" && (BLOCK_TYPES as readonly string[]).includes(value);
}

/** Default (empty-but-valid-to-edit) data for a freshly added block of `type`. */
export function defaultBlockData(type: BlockType): Record<string, unknown> {
  switch (type) {
    case "hero": return { eyebrow: "", heading: "", subheading: "", primaryCtaLabel: "", primaryCtaHref: "", secondaryCtaLabel: "", secondaryCtaHref: "", imageUrl: "", imageAlt: "" };
    case "richText": return { eyebrow: "", html: "" };
    case "cta": return { heading: "", text: "", buttonLabel: "", buttonHref: "", secondaryLabel: "", secondaryHref: "" };
    case "cards": return { heading: "", intro: "", columns: 3, variant: "default", introPlacement: "auto", items: [{ title: "", text: "", href: "", linkLabel: "" }] };
    case "testimonials": return { heading: "", testimonialIds: [] };
    case "faq": return { heading: "Frequently asked questions", source: "custom", faqIds: [], items: [{ question: "", answer: "" }] };
    case "pricing": return { heading: "", intro: "", packageSlugs: [] };
    case "trustBadges": return { heading: "", items: [{ label: "", imageUrl: "", imageAlt: "" }] };
    case "leadForm": return { heading: "Get in touch", text: "", submitLabel: "Send", successMessage: "Thanks — we'll be in touch shortly.", showPhone: false, showCompany: false, showMessage: true };
    case "metricHero": return { eyebrow: "", label: "", value: "", from: "", to: "", caption: "" };
    case "factsStrip": return { items: [{ label: "", value: "" }] };
    case "dataTable": return { heading: "", intro: "", columns: ["", ""], rows: [["", ""]], footnote: "", highlightLastColumn: false };
    case "proofGallery": return { heading: "", intro: "", columns: 2, items: [{ imageUrl: "", imageAlt: "", caption: "", badge: "" }] };
    case "pullQuote": return { quote: "", name: "", role: "" };
    case "takeaway": return { label: "Key takeaway", text: "" };
  }
}
