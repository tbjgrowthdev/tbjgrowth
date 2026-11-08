// Plain text of a block list, for the editor's SEO panel (word count, keyword checks) — block pages store their
// copy in `blocks`, not `content`. Skips structural/URL fields. Accepts the editor's loosely typed blocks.
const SKIP_KEYS = /(Href|Url|Id|Ids|Slugs|source|columns|submitLabel|successMessage)$/;

type Loose = { type?: string; data?: unknown };

function collect(value: unknown, key: string, out: string[]) {
  if (typeof value === "string") {
    if (!SKIP_KEYS.test(key) && value.trim()) out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collect(v, key, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) collect(v, k, out);
  }
}

export function blocksToText(blocks: Loose[]): string {
  const out: string[] = [];
  for (const b of blocks) if (b.type !== "reusable") collect(b.data, "", out);
  return out.join("\n");
}
