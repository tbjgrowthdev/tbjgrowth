import { prisma } from "@/lib/prisma";
import { tokenize, jaccardSimilarity } from "@/lib/content-pipeline/quality-gate";
import type { LinkSuggestion, OrphanPageCandidate } from "./types";

// Same caveat as every other threshold introduced this way in this codebase: a starting point, not tuned against real outcomes.
const MIN_SUGGESTION_SIMILARITY = 0.3; // same bar lib/content-cannibalization/detect.ts uses for "similar enough to call related"
const MAX_SUGGESTIONS_PER_TARGET = 3;
const WEAK_LINK_MAX = 1; // 0 inbound links = orphan, exactly 1 = weakly linked (a single source page is fragile); 2+ is healthy and never flagged

type ContentItem = {
  contentType: "POST" | "CASE_STUDY";
  contentId: string;
  title: string;
  path: string;
  focusKeyword: string | null;
  content: string;
  tokens: Set<string>;
};

const HREF_PATTERN = /href="(\/[^"#]*)"/g;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The same Post+CaseStudy universe lib/content-cannibalization/detect.ts
 * uses — Pages and Services are excluded both as targets (they're normally
 * reached via primary navigation, not cross-content links, so "orphan"
 * doesn't mean the same thing for them) and as link sources (their body
 * content is templated/structural rather than editorial prose suited to
 * contextual internal linking).
 */
async function getLinkableContent(): Promise<ContentItem[]> {
  const [posts, caseStudies] = await Promise.all([
    prisma.post.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true, slug: true, focusKeyword: true, content: true } }),
    prisma.caseStudy.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true, slug: true, focusKeyword: true, content: true } }),
  ]);
  return [
    ...posts.map((p) => ({
      contentType: "POST" as const,
      contentId: p.id,
      title: p.title,
      path: `/blog/${p.slug}`,
      focusKeyword: p.focusKeyword,
      content: p.content,
      tokens: tokenize(`${p.title} ${p.focusKeyword || ""} ${p.content}`),
    })),
    ...caseStudies.map((c) => ({
      contentType: "CASE_STUDY" as const,
      contentId: c.id,
      title: c.title,
      path: `/case-studies/${c.slug}`,
      focusKeyword: c.focusKeyword,
      content: c.content,
      tokens: tokenize(`${c.title} ${c.focusKeyword || ""} ${c.content}`),
    })),
  ];
}

function buildInboundLinkCounts(items: ContentItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const m of item.content.matchAll(HREF_PATTERN)) {
      const path = m[1].replace(/\/+$/, "") || "/";
      counts.set(path, (counts.get(path) || 0) + 1);
    }
  }
  return counts;
}

/**
 * The first sentence in `text` containing one of `sharedTokens`, as a
 * human-checkable "here's roughly where this would fit" pointer — always
 * lifted verbatim from the source page's own body, never a fabricated
 * sentence.
 */
function extractContext(text: string, sharedTokens: Set<string>): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const words = sentence.toLowerCase().split(/\W+/);
    if (words.some((w) => sharedTokens.has(w))) {
      return sentence.trim().slice(0, 220);
    }
  }
  return text.slice(0, 160).trim();
}

function buildSuggestions(target: ContentItem, items: ContentItem[]): LinkSuggestion[] {
  const candidates = items
    .filter((source) => source.contentId !== target.contentId)
    .map((source) => ({ source, similarity: jaccardSimilarity(target.tokens, source.tokens) }))
    .filter(({ similarity }) => similarity >= MIN_SUGGESTION_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_SUGGESTIONS_PER_TARGET);

  return candidates.map(({ source, similarity }) => {
    const sharedTokens = new Set<string>();
    for (const t of target.tokens) if (source.tokens.has(t)) sharedTokens.add(t);
    return {
      sourceContentType: source.contentType,
      sourceContentId: source.contentId,
      sourceTitle: source.title,
      sourcePath: source.path,
      // Lifted verbatim from the target's own focus keyword/title — never invented wording.
      anchor: target.focusKeyword?.trim() || target.title,
      context: extractContext(stripHtml(source.content), sharedTokens),
      similarity,
    };
  });
}

/**
 * Finds published Posts/CaseStudies with zero or one inbound internal
 * link from another piece of content's body, and for each, suggests up to
 * 3 similar-topic pages to link FROM — ranked by the same Jaccard
 * word-overlap primitive lib/content-cannibalization/detect.ts uses,
 * appropriate at this site's content volume (no embeddings/AI involved).
 */
export async function detectOrphanAndWeakPages(): Promise<OrphanPageCandidate[]> {
  const items = await getLinkableContent();
  const inboundCounts = buildInboundLinkCounts(items);

  return items
    .map((item) => ({ item, inboundLinkCount: inboundCounts.get(item.path) || 0 }))
    .filter(({ inboundLinkCount }) => inboundLinkCount <= WEAK_LINK_MAX)
    .map(({ item, inboundLinkCount }) => ({
      contentType: item.contentType,
      contentId: item.contentId,
      title: item.title,
      path: item.path,
      inboundLinkCount,
      strength: (inboundLinkCount === 0 ? "orphan" : "weak") as "orphan" | "weak",
      suggestions: buildSuggestions(item, items),
    }));
}
