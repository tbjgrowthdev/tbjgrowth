import { prisma } from "@/lib/prisma";
import { fetchSearchVolume, fetchTopSearchQueries } from "@/lib/seo-services";
import { jaccardSimilarity, tokenize } from "@/lib/content-pipeline/quality-gate";
import { FORMAT_LABEL } from "./types";
import type { RecommendationCandidate } from "./types";

// Same reasoning as content-refresh/detect.ts's thresholds — starting
// points grounded in what the data actually looks like, not tuned against
// real outcomes yet.
const MIN_IMPRESSIONS = 10; // below this, a query's "gap" status is just noise
const NOT_RANKING_WELL_POSITION = 10; // already on page 1 — not a gap, even with no dedicated content
const STRIKE_DISTANCE_POSITION = 20; // positions 11-20: close enough that dedicated content is a comparatively small lift
const ALREADY_COVERED_SIMILARITY = 0.3; // lower than quality-gate's 0.5 duplicate-content bar — queries/titles are short, so less overlap is needed to call it "the same topic"
const DEFAULT_TRACKED_KEYWORD_SCORE = 40; // flat fallback when DataForSEO volume isn't available for an orphaned tracked keyword

function classifyFormat(keyword: string): { suggestedFormat: string; contentType: "POST" | "CASE_STUDY" } {
  const k = keyword.toLowerCase();
  if (/\b(vs|versus|compare|comparison)\b/.test(k)) return { suggestedFormat: FORMAT_LABEL.COMPARISON, contentType: "POST" };
  if (/\bcase stud(y|ies)|success stor(y|ies)|results?\b/.test(k)) return { suggestedFormat: FORMAT_LABEL.CASE_STUDY, contentType: "CASE_STUDY" };
  if (/\b(how to|how do|guide|step[\s-]?by[\s-]?step|tips)\b/.test(k)) return { suggestedFormat: FORMAT_LABEL.HOW_TO, contentType: "POST" };
  if (/\b(best|top \d*|cheapest|examples?)\b/.test(k)) return { suggestedFormat: FORMAT_LABEL.LISTICLE, contentType: "POST" };
  if (/\b(what is|what are|define|definition|meaning)\b/.test(k)) return { suggestedFormat: FORMAT_LABEL.EXPLAINER, contentType: "POST" };
  return { suggestedFormat: FORMAT_LABEL.STANDARD, contentType: "POST" };
}

function buildTopic(keyword: string, suggestedFormat: string): string {
  const titleCased = keyword.replace(/\b\w/g, (c) => c.toUpperCase());
  switch (suggestedFormat) {
    case FORMAT_LABEL.HOW_TO:
      return `How to ${keyword.replace(/^how to\s*/i, "")}`.replace(/\b\w/g, (c) => c.toUpperCase());
    case FORMAT_LABEL.LISTICLE:
      return `${titleCased}: A Practical Shortlist`;
    case FORMAT_LABEL.COMPARISON:
      return `${titleCased}: Which Is Right for You?`;
    case FORMAT_LABEL.EXPLAINER:
      return `${titleCased}, Explained`;
    case FORMAT_LABEL.CASE_STUDY:
      return `${titleCased}: A Case Study`;
    default:
      return titleCased;
  }
}

async function getExistingContentTokens(): Promise<Set<string>[]> {
  const [posts, caseStudies] = await Promise.all([
    prisma.post.findMany({ select: { title: true, focusKeyword: true } }),
    prisma.caseStudy.findMany({ select: { title: true, focusKeyword: true } }),
  ]);
  return [...posts, ...caseStudies].map((item) => tokenize(`${item.title} ${item.focusKeyword || ""}`));
}

function alreadyCovered(keyword: string, existingTokenSets: Set<string>[]): boolean {
  const keywordTokens = tokenize(keyword);
  return existingTokenSets.some((tokens) => jaccardSimilarity(keywordTokens, tokens) >= ALREADY_COVERED_SIMILARITY);
}

async function gscCandidates(existingTokenSets: Set<string>[]): Promise<RecommendationCandidate[]> {
  const queries = await fetchTopSearchQueries(300);
  if (!queries) return [];

  return queries
    .filter((q) => q.impressions >= MIN_IMPRESSIONS && q.position > NOT_RANKING_WELL_POSITION)
    .filter((q) => !alreadyCovered(q.query, existingTokenSets))
    .map((q) => {
      const { suggestedFormat, contentType } = classifyFormat(q.query);
      const strikeDistance = q.position <= STRIKE_DISTANCE_POSITION;
      const priorityScore = q.impressions * (strikeDistance ? 1.5 : 1);
      const reasoning = `${q.impressions} impressions over the last 90 days at an average position of ${q.position.toFixed(1)} with no dedicated content — ${
        strikeDistance ? "close enough to page 1 that dedicated content is a comparatively small lift" : "real search demand but no content targets it at all yet"
      }. CTR is ${(q.ctr * 100).toFixed(1)}%.`;
      return { keyword: q.query, topic: buildTopic(q.query, suggestedFormat), suggestedFormat, contentType, priorityScore, reasoning, source: "gsc_query" as const };
    });
}

async function trackedKeywordCandidates(existingTokenSets: Set<string>[], excludeKeywords: Set<string>): Promise<RecommendationCandidate[]> {
  const tracked = await prisma.trackedKeyword.findMany();
  const [posts, caseStudies] = await Promise.all([
    prisma.post.findMany({ select: { slug: true } }),
    prisma.caseStudy.findMany({ select: { slug: true } }),
  ]);
  const existingPaths = new Set([...posts.map((p) => `/blog/${p.slug}`), ...caseStudies.map((c) => `/case-studies/${c.slug}`)]);

  const orphaned = tracked.filter((k) => (!k.targetUrl || !existingPaths.has(k.targetUrl)) && !alreadyCovered(k.term, existingTokenSets) && !excludeKeywords.has(k.term.toLowerCase()));
  if (orphaned.length === 0) return [];

  const volumes = await fetchSearchVolume(orphaned.slice(0, 20).map((k) => k.term));
  const volumeByKeyword = new Map((volumes || []).map((v) => [v.keyword.toLowerCase(), v.searchVolume]));

  return orphaned.map((k) => {
    const { suggestedFormat, contentType } = classifyFormat(k.term);
    const volume = volumeByKeyword.get(k.term.toLowerCase());
    const priorityScore = volume ?? DEFAULT_TRACKED_KEYWORD_SCORE;
    const reasoning = volume
      ? `Tracked keyword with ~${volume}/mo search volume and no dedicated content (${k.targetUrl ? `its target URL "${k.targetUrl}" no longer resolves to live content` : "no target URL set"}).`
      : `Tracked keyword with no dedicated content (${k.targetUrl ? `its target URL "${k.targetUrl}" no longer resolves to live content` : "no target URL set"}); search-volume data wasn't available to size the opportunity.`;
    return { keyword: k.term, topic: buildTopic(k.term, suggestedFormat), suggestedFormat, contentType, priorityScore, reasoning, source: "tracked_keyword" as const };
  });
}

/**
 * Finds keyword gaps from two sources — GSC queries with real demand but
 * no dedicated content, and explicitly tracked keywords with no live
 * content behind them. Each candidate gets a raw priorityScore but isn't
 * bucketed into HIGH/MEDIUM/LOW yet — that needs the full candidate list
 * ranked against each other, which is what recommend.ts's
 * runRecommendationScan does with this function's output.
 * Read-only, same as content-refresh/detect.ts's scanForRefreshCandidates.
 */
export async function scanForRecommendationCandidates(): Promise<RecommendationCandidate[]> {
  const existingTokenSets = await getExistingContentTokens();
  const gsc = await gscCandidates(existingTokenSets);
  const tracked = await trackedKeywordCandidates(existingTokenSets, new Set(gsc.map((c) => c.keyword.toLowerCase())));
  return [...gsc, ...tracked];
}
