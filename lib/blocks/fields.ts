import type { BlockType } from "./types";

// Declarative field definitions for the admin block editor
// (components/Admin/Blocks/BlockFields.tsx). One generic renderer walks these,
// so adding a block type means a schema in schema.ts, an entry here, and a
// renderer — no new editor UI. Validation is NOT done from these definitions;
// the zod schemas in schema.ts are the single source of truth.

export type FieldDef =
  | { key: string; label: string; kind: "text" | "url" | "image"; placeholder?: string; help?: string }
  | { key: string; label: string; kind: "textarea"; rows?: number; placeholder?: string; help?: string }
  | { key: string; label: string; kind: "richtext" }
  | { key: string; label: string; kind: "toggle"; help?: string }
  | { key: string; label: string; kind: "select"; options: { value: string; label: string }[] }
  | { key: string; label: string; kind: "picker"; source: "testimonials" | "faqs" | "packages"; help?: string; showWhen?: { key: string; equals: string } }
  | { key: string; label: string; kind: "table"; columnsKey: string; maxColumns: number; maxRows: number; help?: string }
  | { key: string; label: string; kind: "list"; itemLabel: string; fields: FieldDef[]; showWhen?: { key: string; equals: string } };

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Hero",
  richText: "Rich text",
  cta: "Call to action",
  cards: "Feature / service cards",
  testimonials: "Testimonials",
  faq: "FAQ",
  pricing: "Pricing",
  trustBadges: "Trust badges",
  leadForm: "Lead form",
  metricHero: "Headline metric",
  factsStrip: "Facts strip",
  dataTable: "Data table",
  proofGallery: "Proof gallery",
  pullQuote: "Pull quote",
  takeaway: "Key takeaway",
};

export const BLOCK_HELP: Record<BlockType, string> = {
  hero: "Large headline with up to two buttons and an optional image.",
  richText: "Free-form formatted text (headings, lists, links, images).",
  cta: "A focused call to action with one or two buttons.",
  cards: "A grid of cards — features, services, benefits.",
  testimonials: "Client testimonials from the Testimonials library.",
  faq: "Questions and answers, from the FAQ library or written here. Adds FAQ structured data.",
  pricing: "Pricing packages from Admin → Pricing.",
  trustBadges: "A row of logos or short trust statements (certifications, guarantees, awards).",
  leadForm: "A contact form that saves to Leads and emails the notification address.",
  metricHero: "The big headline number of a case study, with an optional before → after.",
  factsStrip: "Up to 6 label/value facts (Client, Sector, Timeframe, Services…). 4–6 looks best.",
  dataTable: "A plain-text table for results or before/after. Up to 6 columns and 20 rows.",
  proofGallery: "Screenshots or diagrams. Items without a usable image are hidden; if none are usable the whole block is hidden.",
  pullQuote: "A client testimonial. Hidden while the quote is empty — add it once the client approves the wording.",
  takeaway: "A large highlighted key takeaway.",
};

const cta = (prefix: string, title: string): FieldDef[] => [
  { key: `${prefix}Label`, label: `${title} label`, kind: "text" },
  { key: `${prefix}Href`, label: `${title} link`, kind: "url", placeholder: "/contact or https://…" },
];

export const BLOCK_FIELDS: Record<BlockType, FieldDef[]> = {
  hero: [
    { key: "eyebrow", label: "Eyebrow (small text above the heading)", kind: "text" },
    { key: "heading", label: "Heading", kind: "text" },
    { key: "subheading", label: "Subheading", kind: "textarea", rows: 3 },
    ...cta("primaryCta", "Primary button"),
    ...cta("secondaryCta", "Secondary button"),
    { key: "imageUrl", label: "Image", kind: "image" },
    { key: "imageAlt", label: "Image alt text", kind: "text" },
  ],
  richText: [
    { key: "eyebrow", label: "Label (small text above the content)", kind: "text", placeholder: "The business challenge" },
    { key: "html", label: "Content (with a label, start with the main heading, Heading 2)", kind: "richtext" },
  ],
  cta: [
    { key: "heading", label: "Heading", kind: "text" },
    { key: "text", label: "Supporting text", kind: "textarea", rows: 3 },
    { key: "buttonLabel", label: "Button label", kind: "text" },
    { key: "buttonHref", label: "Button link", kind: "url", placeholder: "/contact or https://…" },
    ...cta("secondary", "Secondary button"),
  ],
  cards: [
    { key: "heading", label: "Heading", kind: "text" },
    { key: "intro", label: "Intro text", kind: "textarea", rows: 2 },
    { key: "columns", label: "Columns", kind: "select", options: [{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }] },
    { key: "variant", label: "Style", kind: "select", options: [{ value: "default", label: "Standard cards" }, { value: "stats", label: "Stat cards (title shown as a large figure)" }, { value: "steps", label: "Numbered steps" }] },
    { key: "introPlacement", label: "Intro text position", kind: "select", options: [{ value: "auto", label: "Automatic (below stat cards, above others)" }, { value: "above", label: "Above the cards" }, { value: "below", label: "Below the cards (as a note)" }] },
    {
      key: "items",
      label: "Cards",
      kind: "list",
      itemLabel: "Card",
      fields: [
        { key: "title", label: "Title", kind: "text" },
        { key: "text", label: "Text", kind: "textarea", rows: 3 },
        { key: "href", label: "Link (optional)", kind: "url" },
        { key: "linkLabel", label: "Link label", kind: "text", placeholder: "Learn more" },
      ],
    },
  ],
  testimonials: [
    { key: "heading", label: "Heading", kind: "text" },
    { key: "testimonialIds", label: "Testimonials", kind: "picker", source: "testimonials", help: "Leave empty to show the first few testimonials." },
  ],
  faq: [
    { key: "heading", label: "Heading", kind: "text" },
    { key: "source", label: "Questions come from", kind: "select", options: [{ value: "custom", label: "Written here" }, { value: "library", label: "The FAQ library" }] },
    { key: "faqIds", label: "FAQs", kind: "picker", source: "faqs", help: "Leave empty to show every FAQ.", showWhen: { key: "source", equals: "library" } },
    {
      key: "items",
      label: "Questions",
      kind: "list",
      itemLabel: "Question",
      showWhen: { key: "source", equals: "custom" },
      fields: [
        { key: "question", label: "Question", kind: "text" },
        { key: "answer", label: "Answer", kind: "textarea", rows: 3 },
      ],
    },
  ],
  pricing: [
    { key: "heading", label: "Heading", kind: "text" },
    { key: "intro", label: "Intro text", kind: "textarea", rows: 2 },
    { key: "packageSlugs", label: "Packages", kind: "picker", source: "packages", help: "Leave empty to show every active package." },
  ],
  trustBadges: [
    { key: "heading", label: "Heading", kind: "text" },
    {
      key: "items",
      label: "Badges",
      kind: "list",
      itemLabel: "Badge",
      fields: [
        { key: "label", label: "Label", kind: "text" },
        { key: "imageUrl", label: "Logo / icon (optional)", kind: "image" },
        { key: "imageAlt", label: "Image alt text", kind: "text" },
      ],
    },
  ],
  leadForm: [
    { key: "heading", label: "Heading", kind: "text" },
    { key: "text", label: "Supporting text", kind: "textarea", rows: 2 },
    { key: "submitLabel", label: "Submit button label", kind: "text" },
    { key: "successMessage", label: "Thank-you message", kind: "text" },
    { key: "showPhone", label: "Ask for a phone number", kind: "toggle" },
    { key: "showCompany", label: "Ask for a company name", kind: "toggle" },
    { key: "showMessage", label: "Show a message box", kind: "toggle" },
  ],
  metricHero: [
    { key: "eyebrow", label: "Eyebrow (small text above)", kind: "text" },
    { key: "label", label: "Label", kind: "text", placeholder: "Monthly social reach" },
    { key: "value", label: "Headline value", kind: "text", placeholder: "+423%" },
    { key: "from", label: "From (optional)", kind: "text", placeholder: "18,400" },
    { key: "to", label: "To (optional)", kind: "text", placeholder: "96,300" },
    { key: "caption", label: "Caption", kind: "textarea", rows: 2 },
  ],
  factsStrip: [
    {
      key: "items",
      label: "Facts",
      kind: "list",
      itemLabel: "Fact",
      fields: [
        { key: "label", label: "Label", kind: "text", placeholder: "Client" },
        { key: "value", label: "Value", kind: "text" },
      ],
    },
  ],
  dataTable: [
    { key: "heading", label: "Heading", kind: "text" },
    { key: "intro", label: "Intro text", kind: "textarea", rows: 2 },
    { key: "columns", label: "Table", kind: "table", columnsKey: "columns", maxColumns: 6, maxRows: 20, help: "Plain text only. The first column is the row label." },
    { key: "footnote", label: "Footnote", kind: "text" },
    { key: "highlightLastColumn", label: "Emphasize the last column (e.g. “Change”)", kind: "toggle" },
  ],
  proofGallery: [
    { key: "heading", label: "Heading", kind: "text" },
    { key: "intro", label: "Intro text (shown right above the images)", kind: "textarea", rows: 2 },
    { key: "columns", label: "Columns", kind: "select", options: [{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }] },
    {
      key: "items",
      label: "Images",
      kind: "list",
      itemLabel: "Image",
      fields: [
        { key: "imageUrl", label: "Image", kind: "image" },
        { key: "imageAlt", label: "Alt text", kind: "text" },
        { key: "caption", label: "Caption", kind: "text" },
        { key: "badge", label: "Badge (optional)", kind: "text", placeholder: "Illustrative" },
      ],
    },
  ],
  pullQuote: [
    { key: "quote", label: "Quote", kind: "textarea", rows: 3, help: "Leave empty until the client approves the wording — nothing is shown while it is empty." },
    { key: "name", label: "Name", kind: "text" },
    { key: "role", label: "Role / company", kind: "text" },
  ],
  takeaway: [
    { key: "label", label: "Label", kind: "text", help: "Clear it to show no label." },
    { key: "text", label: "Text", kind: "textarea", rows: 3 },
  ],
};
