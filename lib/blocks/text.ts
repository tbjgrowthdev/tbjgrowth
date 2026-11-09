// Plain text of a block list, for the editor's SEO panel (word count, keyword checks) — block pages store their
// copy in `blocks`, not `content`. Skips structural/URL fields. Accepts the editor's loosely typed blocks.
const SKIP_KEYS = /(Href|Url|Id|Ids|Slugs|source|columns|submitLabel|successMessage|badge|variant)$/;

type Loose = { type?: string; data?: unknown };
type Obj = Record<string, unknown>;

function collect(value: unknown, key: string, out: string[]) {
  if (typeof value === "string") {
    if (!SKIP_KEYS.test(key) && value.trim()) out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collect(v, key, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) collect(v, k, out);
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Narrows a block's data to what is actually visible on the page, so hidden content (an unapproved quote,
 * gallery items without an image) never counts as page copy.
 */
function visibleData(block: Loose): unknown {
  const d = (block.data && typeof block.data === "object" ? block.data : {}) as Obj;
  switch (block.type) {
    case "pullQuote":
      return str(d.quote).trim() ? d : {};
    case "proofGallery":
      return { ...d, items: Array.isArray(d.items) ? d.items.filter((i) => i && typeof i === "object" && str((i as Obj).imageUrl).trim()) : [] };
    case "dataTable": {
      // `columns` is a skipped key elsewhere; for a table the headers are real copy.
      const { columns, ...rest } = d;
      return { ...rest, headers: columns };
    }
    default:
      return d;
  }
}

export function blocksToText(blocks: Loose[]): string {
  const out: string[] = [];
  for (const b of blocks) if (b.type !== "reusable") collect(visibleData(b), "", out);
  return out.join("\n");
}

const stripTags = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** The first prose field in block order, for a meta-description fallback when a case study has no excerpt. */
export function blocksToExcerpt(blocks: Loose[], max = 155): string {
  let found = "";
  for (const b of blocks) {
    const d = (b.data && typeof b.data === "object" ? b.data : {}) as Obj;
    const candidate =
      b.type === "hero" ? str(d.subheading)
      : b.type === "richText" ? stripTags(str(d.html))
      : b.type === "takeaway" ? str(d.text)
      : b.type === "metricHero" ? str(d.caption)
      : b.type === "cards" ? str(d.intro)
      : "";
    if (candidate.trim()) { found = candidate.replace(/\s+/g, " ").trim(); break; }
  }
  if (found.length <= max) return found;
  const cut = found.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}
