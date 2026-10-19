import type { AuditableContent } from "./content-fetch";
import type { SeoAuditFinding } from "./types";

function makeFinding(category: SeoAuditFinding["category"], item: AuditableContent, detail: string): SeoAuditFinding {
  return { category, contentType: item.contentType, contentId: item.contentId, title: item.title, path: item.path, detail };
}

function groupByNormalizedValue(items: AuditableContent[], getValue: (item: AuditableContent) => string | null) {
  const groups = new Map<string, AuditableContent[]>();
  const missing: AuditableContent[] = [];
  for (const item of items) {
    const value = getValue(item)?.trim();
    if (!value) {
      missing.push(item);
      continue;
    }
    const key = value.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return { groups, missing };
}

export function checkTitles(items: AuditableContent[]): SeoAuditFinding[] {
  const findings: SeoAuditFinding[] = [];
  const { groups, missing } = groupByNormalizedValue(items, (i) => i.metaTitle);
  for (const item of missing) findings.push(makeFinding("Missing Title", item, "No meta title set."));
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const item of group) {
      const others = group.filter((g) => g !== item).map((g) => g.path);
      findings.push(makeFinding("Duplicate Title", item, `Meta title shared with ${others.length} other page(s): ${others.join(", ")}`));
    }
  }
  return findings;
}

export function checkMeta(items: AuditableContent[]): SeoAuditFinding[] {
  const findings: SeoAuditFinding[] = [];
  const { groups, missing } = groupByNormalizedValue(items, (i) => i.metaDescription);
  for (const item of missing) findings.push(makeFinding("Missing Meta", item, "No meta description set."));
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const item of group) {
      const others = group.filter((g) => g !== item).map((g) => g.path);
      findings.push(makeFinding("Duplicate Meta", item, `Meta description shared with ${others.length} other page(s): ${others.join(", ")}`));
    }
  }
  return findings;
}

const H1_PATTERN = /<h1[\s>]/i;

/**
 * Every detail-page template in this codebase renders the content's own
 * title as the page's single <h1> — confirmed against the Post, Page,
 * Case Study, and Service templates. So "Missing H1" can only happen if
 * title is empty/whitespace (title is a required field, so this is a
 * defensive check rather than one expected to ever fire), and "Multiple
 * H1" means the body content itself contains an <h1> tag, which would sit
 * alongside the template's own — never a missing-H1 situation.
 */
export function checkH1(items: AuditableContent[]): SeoAuditFinding[] {
  const findings: SeoAuditFinding[] = [];
  for (const item of items) {
    if (!item.title?.trim()) {
      findings.push(makeFinding("Missing H1", item, "Title is empty — the page template renders the title as the page's only H1."));
    }
    if (item.content && H1_PATTERN.test(item.content)) {
      findings.push(
        makeFinding("Multiple H1", item, "Body content contains an <h1> tag, duplicating the H1 the page template already renders from the title.")
      );
    }
  }
  return findings;
}

/** Live (published/existing) content that's set to noindex — not necessarily wrong, but often an oversight worth a second look. */
export function checkNoindex(items: AuditableContent[]): SeoAuditFinding[] {
  return items.filter((i) => !i.isIndexable).map((i) => makeFinding("Noindex Issues", i, "This live page is set to noindex and won't appear in search results."));
}

// A commonly used SEO floor for "substantive" body content — not an exact
// science, but a reasonable, documented threshold rather than an arbitrary
// unexplained number.
const THIN_CONTENT_MIN_WORDS = 300;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

export function checkThinContent(items: AuditableContent[]): SeoAuditFinding[] {
  const findings: SeoAuditFinding[] = [];
  for (const item of items) {
    const text = item.content ? stripHtml(item.content).trim() : "";
    const wordCount = text ? text.split(/\s+/).length : 0;
    if (wordCount < THIN_CONTENT_MIN_WORDS) {
      findings.push(makeFinding("Thin Content", item, `Only ${wordCount} word(s) in the body — below the ${THIN_CONTENT_MIN_WORDS}-word guideline for substantive content.`));
    }
  }
  return findings;
}

const IMG_TAG_PATTERN = /<img\b[^>]*>/gi;
const ALT_ATTR_PATTERN = /\balt\s*=\s*"([^"]*)"/i;

export function checkMissingAlt(items: AuditableContent[]): SeoAuditFinding[] {
  const findings: SeoAuditFinding[] = [];
  for (const item of items) {
    if (item.hasFeaturedImage && !item.featuredImageAlt?.trim()) {
      findings.push(makeFinding("Missing Alt", item, "Featured image has no alt text."));
    }
    if (!item.content) continue;
    const imgTags = item.content.match(IMG_TAG_PATTERN) || [];
    const missingInBody = imgTags.filter((tag) => {
      const match = tag.match(ALT_ATTR_PATTERN);
      return !match || !match[1].trim();
    }).length;
    if (missingInBody > 0) {
      findings.push(makeFinding("Missing Alt", item, `${missingInBody} image(s) in the body content have no alt text.`));
    }
  }
  return findings;
}

/** Validates a manual schema.org JSON-LD override — the auto-generated schema (lib/schema-engine.ts) is never checked here since it's built from already-valid real data. */
export function checkSchema(items: AuditableContent[]): SeoAuditFinding[] {
  const findings: SeoAuditFinding[] = [];
  for (const item of items) {
    if (!item.schemaJson?.trim()) continue;
    try {
      const parsed: unknown = JSON.parse(item.schemaJson);
      const isValidJsonLd = typeof parsed === "object" && parsed !== null && "@context" in parsed && "@type" in parsed;
      if (!isValidJsonLd) {
        findings.push(makeFinding("Schema Problems", item, "Manual schema override is valid JSON but missing @context or @type — not valid JSON-LD."));
      }
    } catch {
      findings.push(makeFinding("Schema Problems", item, "Manual schema override is not valid JSON."));
    }
  }
  return findings;
}

const HREF_PATTERN = /href="(\/[^"#]*)"/g;

// Services and Pages are typically reached via primary navigation/footer
// (hardcoded in Navbar/Footer, not in any content body), so checking them
// for inbound content-body links would flag nearly all of them — a
// deliberate scope cut to Post/CaseStudy, where internal linking from other
// articles is the actual SEO practice this check is meant to enforce.
const ORPHAN_ELIGIBLE_TYPES = new Set(["POST", "CASE_STUDY"]);

export function checkOrphans(items: AuditableContent[]): SeoAuditFinding[] {
  const linkedPaths = new Set<string>();
  for (const item of items) {
    if (!item.content) continue;
    for (const m of item.content.matchAll(HREF_PATTERN)) {
      linkedPaths.add(m[1].replace(/\/+$/, "") || "/");
    }
  }
  return items
    .filter((i) => ORPHAN_ELIGIBLE_TYPES.has(i.contentType) && !linkedPaths.has(i.path))
    .map((i) => makeFinding("Orphan Pages", i, "No other published content links to this page in its body — only reachable via a listing page or navigation."));
}
