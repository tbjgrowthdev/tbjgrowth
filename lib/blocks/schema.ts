import { z } from "zod";
import { sanitizeRichText } from "@/lib/sanitize";
import { BLOCK_TYPES, MAX_BLOCKS_PER_PAGE, isBlockType, defaultBlockData, type BlockType } from "./types";

export { BLOCK_TYPES, MAX_BLOCKS_PER_PAGE, isBlockType, defaultBlockData, type BlockType };

// Landing-page blocks. A page (or pSEO template) stores its layout as a JSON
// array of blocks in a single text column. Everything that is stored OR
// rendered goes through this file, so this is the one place that decides what
// "safe" means:
//
//  - every field is a plain string/number/boolean/list — React escapes text, so
//    only the `richText` block carries HTML, and that is run through
//    sanitizeRichText() both here (on save) and again at render time;
//  - every link must pass isSafeHref() and every image isSafeImageUrl(), so a
//    `javascript:` / `data:` URL can never reach an href or src;
//  - unknown keys are stripped, lists and strings are length-capped.
//
// Pure module (no Prisma, no React) so it is unit-testable and importable from
// client components for the editor's field definitions.


/** Cap on the serialized block list, so one save can't store megabytes (richText alone allows 100k per block). */
export const MAX_BLOCKS_JSON_BYTES = 512 * 1024;
const MAX_ITEMS = 24;
export const MAX_TABLE_COLUMNS = 6;
export const MAX_TABLE_ROWS = 20;
export const MAX_FACTS = 6;
export const MAX_PROOF_ITEMS = 12;

// ---------------------------------------------------------------- url safety

const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;

/** Same-site path ("/about", "#pricing") or an http(s)/mailto/tel URL. Never javascript:, data:, vbscript:, protocol-relative, ... */
export function isSafeHref(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.length > 2048 || CONTROL_OR_BACKSLASH.test(v)) return false;
  if (v.startsWith("#")) return true;
  if (v.startsWith("/")) return !v.startsWith("//");
  try {
    const url = new URL(v);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
}

/** Same-site path or absolute http(s) URL (display-host checks happen at render via isDisplayableImageUrl). */
export function isSafeImageUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.length > 2048 || CONTROL_OR_BACKSLASH.test(v)) return false;
  if (v.startsWith("/")) return !v.startsWith("//");
  try {
    const url = new URL(v);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------- fields

const text = (max: number) => z.string().trim().max(max).default("");
const longText = (max: number) => z.string().max(max).default("");
const optionalHref = z.string().trim().max(2048).default("").refine((v) => v === "" || isSafeHref(v), "Link must be a /path, #anchor, http(s), mailto: or tel: URL");
const optionalImage = z.string().trim().max(2048).default("").refine((v) => v === "" || isSafeImageUrl(v), "Image must be a /path or an http(s) URL");
const idList = z.array(z.string().trim().min(1).max(64)).max(MAX_ITEMS).default([]);

// A button needs both a label and a destination, or neither.
function ctaPairs<T extends Record<string, unknown>>(pairs: [string, string][]) {
  return (data: T, ctx: z.RefinementCtx) => {
    for (const [labelKey, hrefKey] of pairs) {
      const label = data[labelKey] as string;
      const href = data[hrefKey] as string;
      if (Boolean(label) !== Boolean(href)) {
        ctx.addIssue({ code: "custom", path: [href ? labelKey : hrefKey], message: "A button needs both a label and a link" });
      }
    }
  };
}

export const heroSchema = z
  .object({
    eyebrow: text(120),
    heading: z.string().trim().min(1, "Heading is required").max(200),
    subheading: longText(600),
    primaryCtaLabel: text(60),
    primaryCtaHref: optionalHref,
    secondaryCtaLabel: text(60),
    secondaryCtaHref: optionalHref,
    imageUrl: optionalImage,
    imageAlt: text(200),
  })
  .superRefine(ctaPairs([["primaryCtaLabel", "primaryCtaHref"], ["secondaryCtaLabel", "secondaryCtaHref"]]));

export const richTextSchema = z.object({
  // Sanitized on parse: whatever is stored is already clean, and the renderer sanitizes again.
  html: z.string().max(100_000).default("").transform((v) => sanitizeRichText(v)),
});

export const ctaSchema = z
  .object({
    heading: z.string().trim().min(1, "Heading is required").max(200),
    text: longText(600),
    buttonLabel: z.string().trim().min(1, "Button label is required").max(60),
    buttonHref: z.string().trim().min(1, "Button link is required").max(2048).refine(isSafeHref, "Link must be a /path, #anchor, http(s), mailto: or tel: URL"),
    secondaryLabel: text(60),
    secondaryHref: optionalHref,
  })
  .superRefine(ctaPairs([["secondaryLabel", "secondaryHref"]]));

export const cardsSchema = z.object({
  heading: text(200),
  intro: longText(600),
  columns: z.coerce.number().int().min(2).max(4).default(3),
  // "stats" shows the title as a large figure (5.2×); "steps" numbers the cards. Absent = "default" (old data unchanged).
  variant: z.enum(["default", "stats", "steps"]).default("default"),
  items: z
    .array(z.object({ title: z.string().trim().min(1, "Card title is required").max(120), text: longText(600), href: optionalHref, linkLabel: text(60) }))
    .max(MAX_ITEMS)
    .default([]),
});

export const testimonialsSchema = z.object({
  heading: text(200),
  // Empty = the first few testimonials in the library's own order.
  testimonialIds: idList,
});

export const faqSchema = z.object({
  heading: text(200),
  source: z.enum(["library", "custom"]).default("custom"),
  faqIds: idList, // used when source = "library" (empty = all)
  items: z
    .array(z.object({ question: z.string().trim().min(1, "Question is required").max(300), answer: z.string().trim().min(1, "Answer is required").max(3000) }))
    .max(MAX_ITEMS)
    .default([]),
});

export const pricingSchema = z.object({
  heading: text(200),
  intro: longText(600),
  // Empty = every active package.
  packageSlugs: idList,
});

export const trustBadgesSchema = z.object({
  heading: text(200),
  items: z
    .array(z.object({ label: z.string().trim().min(1, "Badge label is required").max(120), imageUrl: optionalImage, imageAlt: text(200) }))
    .max(MAX_ITEMS)
    .default([]),
});

export const leadFormSchema = z.object({
  heading: z.string().trim().min(1, "Heading is required").max(200),
  text: longText(600),
  submitLabel: z.string().trim().min(1).max(60).default("Send"),
  successMessage: z.string().trim().min(1).max(300).default("Thanks — we'll be in touch shortly."),
  showPhone: z.boolean().default(false),
  showCompany: z.boolean().default(false),
  showMessage: z.boolean().default(true),
});

// ------------------------------------------------------- case-study blocks
// Text only: every field below renders as a React text child, none accepts HTML.

export const metricHeroSchema = z
  .object({
    eyebrow: text(120),
    label: z.string().trim().min(1, "Label is required").max(120),
    value: z.string().trim().min(1, "Value is required").max(40),
    from: text(40),
    to: text(40),
    caption: longText(300),
  })
  .superRefine((d, ctx) => {
    if (Boolean(d.from) !== Boolean(d.to)) ctx.addIssue({ code: "custom", path: [d.from ? "to" : "from"], message: "Fill in both From and To, or neither" });
  });

export const factsStripSchema = z.object({
  items: z
    .array(z.object({ label: z.string().trim().min(1, "Label is required").max(60), value: z.string().trim().min(1, "Value is required").max(160) }))
    .max(MAX_FACTS)
    .default([]),
});

export const dataTableSchema = z
  .object({
    heading: text(200),
    intro: longText(600),
    columns: z.array(z.string().trim().min(1, "Column header is required").max(60)).min(1, "At least one column is required").max(MAX_TABLE_COLUMNS),
    rows: z.array(z.array(z.string().trim().max(200))).max(MAX_TABLE_ROWS).default([]),
    footnote: longText(300),
    highlightLastColumn: z.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    d.rows.forEach((row, i) => {
      if (row.length !== d.columns.length) ctx.addIssue({ code: "custom", path: ["rows", i], message: `Row ${i + 1} has ${row.length} cells but there are ${d.columns.length} columns` });
    });
  });

export const proofGallerySchema = z.object({
  heading: text(200),
  columns: z.coerce.number().int().min(1).max(3).default(2),
  // imageUrl may be empty while screenshots are being prepared; such items are skipped at render time.
  items: z
    .array(z.object({ imageUrl: optionalImage, imageAlt: text(200), caption: text(300), badge: text(40) }))
    .max(MAX_PROOF_ITEMS)
    .default([]),
});

export const pullQuoteSchema = z.object({
  // Empty quote is valid: the block simply doesn't render until the wording is approved.
  quote: z.string().trim().max(600).default(""),
  name: text(120),
  role: text(160),
});

export const takeawaySchema = z.object({
  label: text(60).default("Key takeaway"),
  text: z.string().trim().min(1, "Text is required").max(500),
});

export const BLOCK_DATA_SCHEMAS = {
  hero: heroSchema,
  richText: richTextSchema,
  cta: ctaSchema,
  cards: cardsSchema,
  testimonials: testimonialsSchema,
  faq: faqSchema,
  pricing: pricingSchema,
  trustBadges: trustBadgesSchema,
  leadForm: leadFormSchema,
  metricHero: metricHeroSchema,
  factsStrip: factsStripSchema,
  dataTable: dataTableSchema,
  proofGallery: proofGallerySchema,
  pullQuote: pullQuoteSchema,
  takeaway: takeawaySchema,
} as const satisfies Record<BlockType, z.ZodType>;

export type BlockData<T extends BlockType> = z.output<(typeof BLOCK_DATA_SCHEMAS)[T]>;

export type ConcreteBlock = { [T in BlockType]: { id: string; type: T; data: BlockData<T> } }[BlockType];
export type ReusableRef = { id: string; type: "reusable"; blockId: string };
export type PageBlock = ConcreteBlock | ReusableRef;

// ------------------------------------------------------------------ parsing

function describe(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Validates and cleans one block's data. Unknown keys are dropped; richText HTML is sanitized. */
export function parseBlockData<T extends BlockType>(type: T, data: unknown): ParseResult<BlockData<T>> {
  const parsed = BLOCK_DATA_SCHEMAS[type].safeParse(data ?? {});
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  return { ok: true, value: parsed.data as BlockData<T> };
}

function parseOne(raw: unknown, index: number): ParseResult<PageBlock> {
  const label = `Block ${index + 1}`;
  if (!raw || typeof raw !== "object") return { ok: false, error: `${label}: not a block` };
  const { id, type, blockId, data } = raw as Record<string, unknown>;
  const blockKey = typeof id === "string" && id.trim() && id.length <= 64 ? id.trim() : null;
  if (!blockKey) return { ok: false, error: `${label}: missing id` };

  if (type === "reusable") {
    if (typeof blockId !== "string" || !blockId.trim() || blockId.length > 64) return { ok: false, error: `${label}: reusable block has no blockId` };
    return { ok: true, value: { id: blockKey, type: "reusable", blockId: blockId.trim() } };
  }
  if (!isBlockType(type)) return { ok: false, error: `${label}: unknown block type` };
  const result = parseBlockData(type, data);
  if (!result.ok) return { ok: false, error: `${label} (${type}): ${result.error}` };
  return { ok: true, value: { id: blockKey, type, data: result.value } as ConcreteBlock };
}

/**
 * Save-time normalization (strict): validates the editor's payload, returning the first error so the admin can
 * fix it. Returns `json: null` for an empty list — the page then renders as a classic rich-text page.
 */
export function normalizeBlocksInput(input: unknown): ParseResult<{ blocks: PageBlock[]; json: string | null }> {
  if (input == null || input === "") return { ok: true, value: { blocks: [], json: null } };
  let list: unknown = input;
  if (typeof input === "string") {
    try {
      list = JSON.parse(input);
    } catch {
      return { ok: false, error: "Blocks are not valid JSON" };
    }
  }
  if (!Array.isArray(list)) return { ok: false, error: "Blocks must be a list" };
  if (list.length > MAX_BLOCKS_PER_PAGE) return { ok: false, error: `A page can have at most ${MAX_BLOCKS_PER_PAGE} blocks` };

  const blocks: PageBlock[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    const result = parseOne(list[i], i);
    if (!result.ok) return result;
    if (seen.has(result.value.id)) return { ok: false, error: `Block ${i + 1}: duplicate block id` };
    seen.add(result.value.id);
    blocks.push(result.value);
  }
  const json = blocks.length ? JSON.stringify(blocks) : null;
  if (json && new TextEncoder().encode(json).length > MAX_BLOCKS_JSON_BYTES) {
    return { ok: false, error: `The block content is too large (limit ${MAX_BLOCKS_JSON_BYTES / 1024} KB)` };
  }
  return { ok: true, value: { blocks, json } };
}

/**
 * Render-time parsing (lenient, defense in depth): re-validates whatever is stored — it may predate a rule or have
 * been written by another path — and silently drops any block that fails, rather than breaking the whole page.
 */
export function parseStoredBlocks(raw: string | null | undefined): PageBlock[] {
  if (!raw) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  const blocks: PageBlock[] = [];
  list.slice(0, MAX_BLOCKS_PER_PAGE).forEach((item, i) => {
    const result = parseOne(item, i);
    if (result.ok) blocks.push(result.value);
  });
  return blocks;
}

export function reusableBlockIds(blocks: PageBlock[]): string[] {
  return [...new Set(blocks.flatMap((b) => (b.type === "reusable" ? [b.blockId] : [])))];
}
