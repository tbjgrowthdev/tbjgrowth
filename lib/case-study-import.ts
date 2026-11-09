import { sanitizeRichText } from "@/lib/sanitize";
import { slugify } from "@/lib/utils";
import { isDisplayableImageUrl } from "@/lib/image-hosts";
import { withFreshIds } from "@/lib/blocks/import";
import { MAX_BLOCKS_PER_PAGE, isSafeImageUrl, normalizeBlocksInput, type PageBlock } from "@/lib/blocks/schema";
import {
  CASE_STUDY_BOOLEAN_FIELDS, CASE_STUDY_IMPORT_KEYS, CASE_STUDY_LIST_FIELDS, CASE_STUDY_NUMBER_FIELDS,
  IMPORT_FORBIDDEN_KEYS, IMPORT_KNOWN_KEYS, type CaseStudyImportFields,
} from "@/lib/case-study-import-fields";

// Server-side validation of an "Import JSON" document. A document is either a bare block list (the original import)
// or an object carrying case study form fields plus `blocks`. The result only FILLS THE FORM: nothing here writes to
// the database, and createCaseStudy / updateCaseStudy validate everything again on save. Status is never importable.

type Obj = Record<string, unknown>;

const MAX_TEXT: Record<string, number> = {
  title: 200, slug: 200, clientName: 200, industry: 200, serviceType: 200, results: 500, excerpt: 1000,
  featuredImageAlt: 300, content: 200_000,
  metaTitle: 200, metaDescription: 500, focusKeyword: 120,
  ogTitle: 200, ogDescription: 500, twitterTitle: 200, twitterDescription: 500,
};
const MAX_GALLERY = 20;
const MAX_KEYWORDS = 20;
const MAX_KEYWORD_LENGTH = 120;
const MAX_SCHEMA_JSON = 20_000;
const TWITTER_CARDS = ["summary", "summary_large_image"];
const IMAGE_PREVIEWS = ["none", "standard", "large"];

export type ImportValidation =
  | { ok: true; fields: CaseStudyImportFields; blocks: PageBlock[] | null; warnings: string[] }
  | { ok: false; error: string };

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** "clientname" / "cleintName" → "clientName"; undefined when nothing is close. */
export function suggestKey(key: string): string | undefined {
  const lower = key.toLowerCase();
  const exact = IMPORT_KNOWN_KEYS.find((k) => k.toLowerCase() === lower);
  if (exact) return exact;
  // Abbreviations ("metaDesc", "client") — a unique prefix of a known key.
  if (lower.length >= 4) {
    const prefixed = IMPORT_KNOWN_KEYS.filter((k) => k.toLowerCase().startsWith(lower));
    if (prefixed.length === 1) return prefixed[0];
  }
  let best: string | undefined;
  let bestD = 3;
  for (const k of IMPORT_KNOWN_KEYS) {
    const d = distance(lower, k.toLowerCase());
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

function textField(key: string, raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: `${key}: must be text` };
  const max = MAX_TEXT[key] ?? 2048;
  if (raw.length > max) return { ok: false, error: `${key}: too long (${raw.length} characters, limit ${max})` };
  return { ok: true, value: key === "content" ? sanitizeRichText(raw) : raw.trim() };
}

function checkHttpUrl(key: string, v: string): string | null {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? null : `${key}: must be an http(s) URL`;
  } catch {
    return `${key}: must be a full http(s) URL`;
  }
}

/**
 * `target: "caseStudy"` validates and returns every form field present; `"blocks"` (pages, pSEO templates) takes only
 * `blocks` and reports the rest as ignored. Unknown or misspelled keys are warnings, never silently dropped.
 */
export function validateImportDocument(input: unknown, target: "caseStudy" | "blocks"): ImportValidation {
  const warnings: string[] = [];
  const doc: Obj = Array.isArray(input) ? { blocks: input } : input && typeof input === "object" ? (input as Obj) : {};
  if (!Array.isArray(input) && (!input || typeof input !== "object")) return { ok: false, error: "Expected a list of blocks, or an object" };

  const fields: Obj = {};

  for (const key of Object.keys(doc)) {
    if (key === "blocks") continue;
    if (IMPORT_FORBIDDEN_KEYS.includes(key)) {
      warnings.push(key === "status" ? "“status” is never imported — new case studies stay Draft and move through the workflow" : `“${key}” is not importable and was ignored`);
    } else if (!CASE_STUDY_IMPORT_KEYS.includes(key)) {
      const hint = suggestKey(key);
      warnings.push(`Unknown field “${key}” was ignored${hint ? ` — did you mean “${hint}”?` : ""}`);
    } else if (target !== "caseStudy") {
      warnings.push(`“${key}” only applies to case studies and was ignored here`);
    }
  }

  if (target === "caseStudy") {
    // Text fields, in the form's order so the first error is predictable.
    for (const key of CASE_STUDY_IMPORT_KEYS) {
      if (!(key in doc) || doc[key] === undefined || doc[key] === null) continue;
      const raw = doc[key];
      if ((CASE_STUDY_LIST_FIELDS as readonly string[]).includes(key)) {
        if (!Array.isArray(raw) || raw.some((x) => typeof x !== "string")) return { ok: false, error: `${key}: must be a list of text values` };
        if (key === "imageGallery") {
          if (raw.length > MAX_GALLERY) return { ok: false, error: `imageGallery: at most ${MAX_GALLERY} images` };
          const urls: string[] = [];
          for (const [i, u] of (raw as string[]).entries()) {
            const url = u.trim();
            if (!isSafeImageUrl(url)) return { ok: false, error: `imageGallery[${i + 1}]: must be a /path or an http(s) image URL` };
            if (!isDisplayableImageUrl(url)) warnings.push(`imageGallery[${i + 1}] is on a host the site doesn't display images from, so it won't show`);
            if (!urls.includes(url)) urls.push(url);
          }
          fields[key] = urls;
        } else {
          const words = [...new Set((raw as string[]).map((w) => w.trim()).filter(Boolean))];
          if (words.length > MAX_KEYWORDS) return { ok: false, error: `secondaryKeywords: at most ${MAX_KEYWORDS} keywords` };
          if (words.some((w) => w.length > MAX_KEYWORD_LENGTH)) return { ok: false, error: `secondaryKeywords: each keyword must be ${MAX_KEYWORD_LENGTH} characters or fewer` };
          fields[key] = words;
        }
      } else if ((CASE_STUDY_BOOLEAN_FIELDS as readonly string[]).includes(key)) {
        if (typeof raw !== "boolean") return { ok: false, error: `${key}: must be true or false` };
        fields[key] = raw;
      } else if ((CASE_STUDY_NUMBER_FIELDS as readonly string[]).includes(key)) {
        const limit = key === "maxSnippet" ? 10_000 : 86_400;
        if (typeof raw !== "number" || !Number.isInteger(raw) || raw < -1 || raw > limit) return { ok: false, error: `${key}: must be a whole number from -1 (unlimited) to ${limit}` };
        fields[key] = raw;
      } else if (key === "schemaJson") {
        // Accepts the JSON as text or as an object. It is later written into a <script> tag, so it must be real JSON
        // and must not be able to close that tag.
        let text: string;
        if (typeof raw === "string") text = raw.trim();
        else if (typeof raw === "object") text = JSON.stringify(raw, null, 2);
        else return { ok: false, error: "schemaJson: must be JSON (an object or a JSON string)" };
        if (text) {
          if (text.length > MAX_SCHEMA_JSON) return { ok: false, error: `schemaJson: too long (limit ${MAX_SCHEMA_JSON} characters)` };
          let parsed: unknown;
          try { parsed = JSON.parse(text); } catch { return { ok: false, error: "schemaJson: not valid JSON" }; }
          if (!parsed || typeof parsed !== "object") return { ok: false, error: "schemaJson: must be a JSON object or list" };
          if (/<\/script|<!--/i.test(text)) return { ok: false, error: "schemaJson: must not contain “</script” or “<!--”" };
          text = typeof raw === "string" ? text : JSON.stringify(parsed, null, 2);
        }
        fields[key] = text;
      } else {
        const r = textField(key, raw);
        if (!r.ok) return r;
        let value = r.value;
        if (key === "slug") {
          const slug = slugify(value);
          if (value && slug !== value) warnings.push(`slug “${value}” was normalized to “${slug}”`);
          if (value && !slug) return { ok: false, error: "slug: has no usable characters (use letters, numbers and hyphens)" };
          value = slug;
        } else if (key === "websiteUrl" || key === "canonicalUrl") {
          if (value) { const e = checkHttpUrl(key, value); if (e) return { ok: false, error: e }; }
        } else if (key === "featuredImage" || key === "ogImage" || key === "twitterImage") {
          if (value) {
            if (!isSafeImageUrl(value)) return { ok: false, error: `${key}: must be a /path or an http(s) image URL` };
            if (!isDisplayableImageUrl(value)) warnings.push(`${key} is on a host the site doesn't display images from, so it may not show`);
          }
        } else if (key === "twitterCard") {
          if (value && !TWITTER_CARDS.includes(value)) return { ok: false, error: `twitterCard: must be one of ${TWITTER_CARDS.join(", ")}` };
        } else if (key === "maxImagePreview") {
          if (!IMAGE_PREVIEWS.includes(value)) return { ok: false, error: `maxImagePreview: must be one of ${IMAGE_PREVIEWS.join(", ")}` };
        }
        fields[key] = value;
      }
    }
  }

  let blocks: PageBlock[] | null = null;
  if ("blocks" in doc && doc.blocks !== undefined && doc.blocks !== null) {
    if (!Array.isArray(doc.blocks)) return { ok: false, error: "blocks: must be a list" };
    if (doc.blocks.length > MAX_BLOCKS_PER_PAGE) return { ok: false, error: `A page can have at most ${MAX_BLOCKS_PER_PAGE} blocks` };
    if (doc.blocks.length > 0) {
      const result = normalizeBlocksInput(withFreshIds(doc.blocks)); // ids in the file are never trusted
      if (!result.ok) return { ok: false, error: result.error };
      blocks = result.value.blocks;
    } else {
      warnings.push("“blocks” is an empty list, so no blocks were imported");
    }
  }

  if (target === "blocks" && !blocks) return { ok: false, error: "Nothing to import: this editor only takes blocks" };
  if (!blocks && Object.keys(fields).length === 0) return { ok: false, error: "Nothing to import: the file has no usable fields or blocks" };
  return { ok: true, fields: fields as CaseStudyImportFields, blocks, warnings };
}
