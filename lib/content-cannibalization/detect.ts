import { prisma } from "@/lib/prisma";
import { fetchPageSearchTrend, fetchPageTrafficTrend, fetchQueryPageOverlap } from "@/lib/seo-services";
import { jaccardSimilarity, tokenize } from "@/lib/content-pipeline/quality-gate";
import type { CannibalizationActionType, CannibalizationCandidate, SharedQuery } from "./types";

// Same "starting point, not tuned against real outcomes" caveat as every
// other threshold introduced this way in this codebase.
const SIMILAR_KEYWORDS_SIMILARITY = 0.3; // minimum overlap to call two pages "similar keywords" at all
const NEAR_DUPLICATE_SIMILARITY = 0.5; // same bar quality-gate.ts uses for single-draft duplicate-content detection
const STRONG_GSC_EVIDENCE_QUERIES = 2; // 2+ shared queries, or...
const STRONG_GSC_EVIDENCE_IMPRESSIONS = 50; // ...one shared query with this much combined impression weight
const WEAK_PERFORMANCE_RATIO = 0.3; // a page doing less than 30% of its pair's combined GA4+GSC activity is "the weak one" for Redirect purposes

type ContentItem = {
  contentType: "POST" | "CASE_STUDY";
  contentId: string;
  title: string;
  slug: string;
  path: string;
  tokens: Set<string>;
};

function canonicalPairKey(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}

async function getPublishedContent(): Promise<ContentItem[]> {
  const [posts, caseStudies] = await Promise.all([
    prisma.post.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true, slug: true, focusKeyword: true, content: true } }),
    prisma.caseStudy.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true, slug: true, focusKeyword: true, content: true } }),
  ]);
  return [
    ...posts.map((p) => ({ contentType: "POST" as const, contentId: p.id, title: p.title, slug: p.slug, path: `/blog/${p.slug}`, tokens: tokenize(`${p.title} ${p.focusKeyword || ""} ${p.content}`) })),
    ...caseStudies.map((c) => ({ contentType: "CASE_STUDY" as const, contentId: c.id, title: c.title, slug: c.slug, path: `/case-studies/${c.slug}`, tokens: tokenize(`${c.title} ${c.focusKeyword || ""} ${c.content}`) })),
  ];
}

/** Every pair of published pages with content similarity at or above SIMILAR_KEYWORDS_SIMILARITY — O(n²), same tradeoff checkDuplicateContent already accepts at this site's content volume. */
function similarContentPairs(items: ContentItem[]): Map<string, number> {
  const bySimilarity = new Map<string, number>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const similarity = jaccardSimilarity(items[i].tokens, items[j].tokens);
      if (similarity >= SIMILAR_KEYWORDS_SIMILARITY) {
        const [a, b] = canonicalPairKey(items[i].contentId, items[j].contentId);
        bySimilarity.set(`${a}:${b}`, similarity);
      }
    }
  }
  return bySimilarity;
}

/** Every pair of pages Search Console shows for the same query, with per-page impressions for that query. */
async function sharedQueryPairs(items: ContentItem[]): Promise<Map<string, SharedQuery[]>> {
  const overlap = await fetchQueryPageOverlap(5);
  const result = new Map<string, SharedQuery[]>();
  if (!overlap) return result;

  const itemByPath = new Map(items.map((i) => [i.path, i]));
  const byQuery = new Map<string, { page: string; impressions: number }[]>();
  for (const row of overlap) {
    let pagePath: string;
    try {
      pagePath = new URL(row.page).pathname;
    } catch {
      continue;
    }
    if (!itemByPath.has(pagePath)) continue;
    const list = byQuery.get(row.query) || [];
    list.push({ page: pagePath, impressions: row.impressions });
    byQuery.set(row.query, list);
  }

  for (const [query, pages] of byQuery) {
    if (pages.length < 2) continue;
    for (let i = 0; i < pages.length; i++) {
      for (let j = i + 1; j < pages.length; j++) {
        const itemA = itemByPath.get(pages[i].page)!;
        const itemB = itemByPath.get(pages[j].page)!;
        const [a, b] = canonicalPairKey(itemA.contentId, itemB.contentId);
        const [impressionsA, impressionsB] = itemA.contentId === a ? [pages[i].impressions, pages[j].impressions] : [pages[j].impressions, pages[i].impressions];
        const list = result.get(`${a}:${b}`) || [];
        list.push({ query, impressionsA, impressionsB });
        result.set(`${a}:${b}`, list);
      }
    }
  }
  return result;
}

async function pagePerformanceScore(item: ContentItem): Promise<number> {
  const [traffic, search] = await Promise.all([fetchPageTrafficTrend(item.path), fetchPageSearchTrend(`${process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com"}${item.path}`)]);
  return (traffic?.recentSessions ?? 0) + (search?.recentClicks ?? 0);
}

function decideAction(similarity: number, sharedQueries: SharedQuery[], perf: { a: number; b: number } | null): CannibalizationActionType {
  const hasStrongGscEvidence = sharedQueries.length >= STRONG_GSC_EVIDENCE_QUERIES || sharedQueries.some((q) => q.impressionsA + q.impressionsB >= STRONG_GSC_EVIDENCE_IMPRESSIONS);

  if (similarity >= NEAR_DUPLICATE_SIMILARITY) {
    if (perf) {
      const total = perf.a + perf.b;
      const weaker = Math.min(perf.a, perf.b);
      if (total > 0 && weaker / total < WEAK_PERFORMANCE_RATIO) return "REDIRECT";
    }
    return "MERGE";
  }
  return hasStrongGscEvidence ? "RETARGET" : "DIFFERENTIATE";
}

function buildReasoning(similarity: number, sharedQueries: SharedQuery[], titleA: string, titleB: string, perf: { a: number; b: number } | null): string {
  const parts: string[] = [];
  if (similarity > 0) parts.push(`${Math.round(similarity * 100)}% word overlap between "${titleA}" and "${titleB}"`);
  if (sharedQueries.length > 0) {
    const top = [...sharedQueries].sort((a, b) => b.impressionsA + b.impressionsB - (a.impressionsA + a.impressionsB)).slice(0, 3);
    parts.push(`both pages get Search Console impressions for ${sharedQueries.length} shared quer${sharedQueries.length === 1 ? "y" : "ies"} (e.g. "${top[0].query}")`);
  }
  if (perf) parts.push(`recent combined traffic/clicks: "${titleA}" ${perf.a}, "${titleB}" ${perf.b}`);
  return parts.length > 0 ? `${parts.join("; ")}.` : "Flagged for review.";
}

/**
 * Finds pairs of published pages that appear to be competing for the
 * same search intent — content similarity (reusing quality-gate.ts's
 * duplicate-content primitive) and/or Search Console showing both pages
 * for the same query (the stronger, more direct signal). Read-only, same
 * as content-refresh/detect.ts and content-recommendations/detect.ts.
 * Page-performance lookups (needed only to tell Merge from Redirect) are
 * fetched lazily, only for pairs that clear the near-duplicate bar, to
 * avoid firing GA4/GSC calls for every pair found by content similarity
 * alone.
 */
export async function scanForCannibalizationPairs(): Promise<CannibalizationCandidate[]> {
  const items = await getPublishedContent();
  const byId = new Map(items.map((i) => [i.contentId, i]));

  const [similarity, sharedQueries] = await Promise.all([Promise.resolve(similarContentPairs(items)), sharedQueryPairs(items)]);

  const pairKeys = new Set([...similarity.keys(), ...sharedQueries.keys()]);
  const performanceCache = new Map<string, number>();
  const getPerf = async (contentId: string) => {
    if (!performanceCache.has(contentId)) performanceCache.set(contentId, await pagePerformanceScore(byId.get(contentId)!));
    return performanceCache.get(contentId)!;
  };

  const candidates: CannibalizationCandidate[] = [];
  for (const key of pairKeys) {
    const [idA, idB] = key.split(":");
    const itemA = byId.get(idA);
    const itemB = byId.get(idB);
    if (!itemA || !itemB) continue;

    const sim = similarity.get(key) ?? 0;
    const shared = sharedQueries.get(key) ?? [];

    const perf = sim >= NEAR_DUPLICATE_SIMILARITY ? { a: await getPerf(idA), b: await getPerf(idB) } : null;
    const suggestedAction = decideAction(sim, shared, perf);
    const reasoning = buildReasoning(sim, shared, itemA.title, itemB.title, perf);

    candidates.push({
      contentTypeA: itemA.contentType,
      contentIdA: idA,
      contentTypeB: itemB.contentType,
      contentIdB: idB,
      similarity: sim,
      sharedQueries: shared,
      suggestedAction,
      reasoning,
    });
  }

  return candidates;
}
