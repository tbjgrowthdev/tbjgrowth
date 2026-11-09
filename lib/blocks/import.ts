import { MAX_BLOCKS_PER_PAGE } from "./types";

// Client-safe helpers for the editor's "Import JSON" dialog (no zod / sanitize-html here). The browser does the cheap
// checks; the real validation is the validateBlocksImport server action (normalizeBlocksInput), and the server
// validates everything again on save.

export const IMPORT_MAX_BYTES = 256 * 1024;

export type ImportResult<T> = { ok: true; value: T } | { ok: false; error: string };
type LooseBlock = { id: string; type: string; data?: unknown; blockId?: string };

/** Parses pasted / file text into a raw block list. Accepts `[...]` or `{ "blocks": [...] }`. */
export function parseImportText(text: string): ImportResult<unknown[]> {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes === 0 || !text.trim()) return { ok: false, error: "Nothing to import — paste JSON or choose a file" };
  if (bytes > IMPORT_MAX_BYTES) return { ok: false, error: `That JSON is ${Math.ceil(bytes / 1024)} KB; the limit is ${IMPORT_MAX_BYTES / 1024} KB` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Not valid JSON: ${e instanceof Error ? e.message : "parse error"}` };
  }
  const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && Array.isArray((parsed as { blocks?: unknown }).blocks) ? (parsed as { blocks: unknown[] }).blocks : null;
  if (!list) return { ok: false, error: "Expected a list of blocks, or an object with a \"blocks\" list" };
  if (list.length === 0) return { ok: false, error: "The list has no blocks" };
  if (list.length > MAX_BLOCKS_PER_PAGE) return { ok: false, error: `A page can have at most ${MAX_BLOCKS_PER_PAGE} blocks (this has ${list.length})` };
  return { ok: true, value: list };
}

let counter = 0;
/** Unique within the page even when many ids are minted in the same millisecond. */
export function newBlockId(): string {
  counter = (counter + 1) % 1_000_000;
  return `b_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Imported ids are never trusted: every block gets a fresh id, so missing or duplicate ids in the JSON can't fail
 * the import, and appended blocks can't collide with ones already in the editor. Only the fields the server
 * validates are carried over; non-objects are passed through so the server reports them ("Block 3: not a block").
 */
export function withFreshIds(list: unknown[]): unknown[] {
  return list.map((item) => (item && typeof item === "object" && !Array.isArray(item) ? { ...(item as object), id: newBlockId() } : item));
}

export function mergeImported<T extends LooseBlock>(existing: T[], imported: T[], mode: "replace" | "append"): ImportResult<T[]> {
  const next = mode === "replace" ? imported : [...existing, ...imported];
  if (next.length > MAX_BLOCKS_PER_PAGE) {
    return { ok: false, error: `That would make ${next.length} blocks; the limit is ${MAX_BLOCKS_PER_PAGE}. Choose “Replace” or remove some blocks first.` };
  }
  return { ok: true, value: next };
}

/** "7 blocks: metricHero, factsStrip ×2, …" */
export function summarizeBlocks(blocks: { type: string }[]): string {
  const counts = new Map<string, number>();
  for (const b of blocks) counts.set(b.type, (counts.get(b.type) ?? 0) + 1);
  const parts = [...counts].map(([t, n]) => (n > 1 ? `${t} ×${n}` : t));
  return `${blocks.length} block${blocks.length === 1 ? "" : "s"}: ${parts.join(", ")}`;
}

export type ImportDocument = { blocks: unknown[] | null; fields: Record<string, unknown> };

/**
 * Like parseImportText, but also accepts a combined file: an object with case study form fields next to `blocks`.
 * A bare list stays a blocks-only import. Only cheap structural checks happen here (size, JSON, shapes, block count);
 * the field rules and block rules are applied by the validateImport server action.
 */
export function parseImportDocument(text: string): ImportResult<ImportDocument> {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes === 0 || !text.trim()) return { ok: false, error: "Nothing to import — paste JSON or choose a file" };
  if (bytes > IMPORT_MAX_BYTES) return { ok: false, error: `That JSON is ${Math.ceil(bytes / 1024)} KB; the limit is ${IMPORT_MAX_BYTES / 1024} KB` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Not valid JSON: ${e instanceof Error ? e.message : "parse error"}` };
  }
  if (Array.isArray(parsed)) {
    const list = parseImportText(text);
    return list.ok ? { ok: true, value: { blocks: list.value, fields: {} } } : list;
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "Expected a list of blocks, or an object with case study fields and/or a \"blocks\" list" };
  const { blocks, ...fields } = parsed as Record<string, unknown>;
  if (blocks !== undefined && blocks !== null && !Array.isArray(blocks)) return { ok: false, error: "blocks: must be a list" };
  if (Array.isArray(blocks) && blocks.length > MAX_BLOCKS_PER_PAGE) return { ok: false, error: `A page can have at most ${MAX_BLOCKS_PER_PAGE} blocks (this has ${blocks.length})` };
  const list = Array.isArray(blocks) && blocks.length > 0 ? blocks : null;
  if (!list && Object.keys(fields).length === 0) return { ok: false, error: "Nothing to import — the file has no fields or blocks" };
  return { ok: true, value: { blocks: list, fields } };
}
