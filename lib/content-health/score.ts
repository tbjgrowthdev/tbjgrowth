import { prisma } from "@/lib/prisma";
import { fetchPageConversions, fetchPageSearchTrend, fetchPageTrafficTrend } from "@/lib/seo-services";
import { getAllContent } from "@/lib/link-monitor";
import { gradeFromScore } from "./types";
import type { ContentHealthResult, FactorScore } from "./types";

// Same "starting point, not tuned against real outcomes" caveat as every
// other threshold introduced this way this session.
const FRESHNESS_FULL_MARKS_DAYS = 90; // updated within this window: full marks
const FRESHNESS_ZERO_DAYS = 540; // ~18 months with no update: zero marks
const RANKING_DECAY_PER_POSITION = 3; // points lost per position below #1

type ScorableItem = {
  contentType: "POST" | "CASE_STUDY";
  contentId: string;
  title: string;
  path: string;
  publishedAt: Date | null;
  updatedAt: Date;
  focusKeyword: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  content: string;
};

async function getScorableContent(): Promise<ScorableItem[]> {
  const [posts, caseStudies] = await Promise.all([
    prisma.post.findMany({ where: { status: "PUBLISHED" } }),
    prisma.caseStudy.findMany({ where: { status: "PUBLISHED" } }),
  ]);
  return [
    ...posts.map((p) => ({
      contentType: "POST" as const, contentId: p.id, title: p.title, path: `/blog/${p.slug}`,
      publishedAt: p.publishedAt, updatedAt: p.updatedAt, focusKeyword: p.focusKeyword,
      metaTitle: p.metaTitle, metaDescription: p.metaDescription, ogTitle: p.ogTitle, ogDescription: p.ogDescription,
      twitterTitle: p.twitterTitle, twitterDescription: p.twitterDescription, content: p.content,
    })),
    ...caseStudies.map((c) => ({
      contentType: "CASE_STUDY" as const, contentId: c.id, title: c.title, path: `/case-studies/${c.slug}`,
      publishedAt: c.publishedAt, updatedAt: c.updatedAt, focusKeyword: c.focusKeyword,
      metaTitle: c.metaTitle, metaDescription: c.metaDescription, ogTitle: c.ogTitle, ogDescription: c.ogDescription,
      twitterTitle: c.twitterTitle, twitterDescription: c.twitterDescription, content: c.content,
    })),
  ];
}

/** Inbound internal link count per path — same regex/content-gathering as lib/link-monitor.ts's internal-link graph, duplicated here in miniature (counts only, no source attribution) rather than reshaping that module's return type for one extra caller. */
async function buildInboundLinkCounts(): Promise<Map<string, number>> {
  const items = await getAllContent();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";
  const baseHost = new URL(baseUrl).host;
  const internalPattern = /href="(\/[^"#]*)"/g;
  const absolutePattern = /href="(https?:\/\/[^"]*)"/g;
  const counts = new Map<string, number>();
  const bump = (path: string) => counts.set(path, (counts.get(path) ?? 0) + 1);

  for (const item of items) {
    if (!item.content) continue;
    for (const m of item.content.matchAll(internalPattern)) bump(m[1]);
    for (const m of item.content.matchAll(absolutePattern)) {
      let host: string;
      try {
        host = new URL(m[1]).host;
      } catch {
        continue;
      }
      if (host === baseHost) bump(new URL(m[1]).pathname);
    }
  }
  return counts;
}

/** 0-100 rank of `value` within `values` — used for Traffic/CTR/Internal Links so the score stays meaningful regardless of this site's absolute scale, same principle as content-recommendations' relative priority tertiles. */
function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 50;
  let below = 0;
  let equal = 0;
  for (const v of values) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  return Math.round(((below + equal / 2) / values.length) * 100);
}

function scoreFreshness(item: ScorableItem): FactorScore {
  const reference = item.publishedAt ?? item.updatedAt;
  const ageDays = (Date.now() - reference.getTime()) / 86_400_000;
  let score: number;
  if (ageDays <= FRESHNESS_FULL_MARKS_DAYS) score = 100;
  else if (ageDays >= FRESHNESS_ZERO_DAYS) score = 0;
  else score = Math.round((100 * (FRESHNESS_ZERO_DAYS - ageDays)) / (FRESHNESS_ZERO_DAYS - FRESHNESS_FULL_MARKS_DAYS));
  return { factor: "freshness", score, detail: `Last updated ${Math.floor(ageDays)} days ago` };
}

function scoreSeoCompleteness(item: ScorableItem): FactorScore {
  const checks: [boolean, string][] = [
    [!!item.metaTitle, "meta title"],
    [!!item.metaDescription, "meta description"],
    [!!item.focusKeyword, "focus keyword"],
    [!!item.ogTitle, "OG title"],
    [!!item.ogDescription, "OG description"],
    [!!item.twitterTitle, "Twitter title"],
    [!!item.twitterDescription, "Twitter description"],
  ];
  const passed = checks.filter(([ok]) => ok);
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  const score = Math.round((passed.length / checks.length) * 100);
  return { factor: "seoCompleteness", score, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All SEO fields set" };
}

function scoreSearchIntent(item: ScorableItem): FactorScore {
  if (!item.focusKeyword) return { factor: "searchIntent", score: null, detail: "No focus keyword set — can't assess search intent fit" };
  const kw = item.focusKeyword.toLowerCase();
  const titleHit = item.title.toLowerCase().includes(kw);
  const headings = (item.content.match(/<h[23][^>]*>(.*?)<\/h[23]>/gi) || []).slice(0, 2).join(" ").toLowerCase();
  const headingHit = headings.includes(kw);
  const bodyText = item.content.replace(/<[^>]+>/g, " ").toLowerCase();
  const bodyHit = bodyText.includes(kw);
  const passed = [titleHit, headingHit, bodyHit].filter(Boolean).length;
  const score = Math.round((passed / 3) * 100);
  const missing = [!titleHit && "title", !headingHit && "an early heading", !bodyHit && "the body"].filter(Boolean);
  return { factor: "searchIntent", score, detail: missing.length ? `Focus keyword missing from: ${missing.join(", ")}` : "Focus keyword present in title, an early heading, and the body" };
}

async function scoreRanking(path: string): Promise<FactorScore> {
  const keywords = await prisma.trackedKeyword.findMany({
    where: { targetUrl: path },
    include: { rankChecks: { orderBy: { checkedAt: "desc" }, take: 1 } },
  });
  if (keywords.length === 0) return { factor: "ranking", score: null, detail: "No tracked keyword targets this page" };

  const positions = keywords.map((k) => k.rankChecks[0]?.position ?? null).filter((p): p is number => p !== null);
  if (positions.length === 0) return { factor: "ranking", score: null, detail: "Tracked, but no rank check has run yet" };

  const best = Math.min(...positions);
  const score = Math.max(0, Math.round(100 - (best - 1) * RANKING_DECAY_PER_POSITION));
  return { factor: "ranking", score, detail: `Best tracked position: #${best}` };
}

const CONCURRENCY = 5;
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    results.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return results;
}

/**
 * Scores every published Post/CaseStudy against the 8 health factors.
 * Traffic, CTR, and Internal Links are scored as a percentile rank
 * against every other page in this same scan (so the score means
 * something regardless of this site's absolute traffic scale); Ranking,
 * Search Intent, Conversion, Freshness, and SEO Completeness are scored
 * directly per page. Any factor with no real data for a page (GA4/GSC
 * not connected, no tracked keyword, no focus keyword) is recorded as
 * `score: null` and excluded from that page's overall average rather
 * than counted as a 0 — a page isn't penalized for a signal nobody set up.
 */
export async function computeHealthScores(): Promise<ContentHealthResult[]> {
  const items = await getScorableContent();
  const inboundLinks = await buildInboundLinkCounts();

  const traffic = await mapWithConcurrency(items, CONCURRENCY, (item) => fetchPageTrafficTrend(item.path));
  const search = await mapWithConcurrency(items, CONCURRENCY, (item) => fetchPageSearchTrend(`${process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com"}${item.path}`));
  const conversions = await mapWithConcurrency(items, CONCURRENCY, (item) => fetchPageConversions(item.path));

  const trafficValues = traffic.map((t) => t?.recentSessions).filter((v): v is number => v != null);
  const ctrValues = search.map((s) => s?.recentCtr).filter((v): v is number => v != null);
  const linkCounts = items.map((item) => inboundLinks.get(item.path) ?? 0);
  const conversionRates = conversions
    .map((c) => (c && c.sessions > 0 ? c.conversions / c.sessions : c ? 0 : null))
    .filter((v): v is number => v !== null);

  const results: ContentHealthResult[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const linkCount = inboundLinks.get(item.path) ?? 0;

    const trafficScore: FactorScore = traffic[i]
      ? { factor: "traffic", score: percentileRank(trafficValues, traffic[i]!.recentSessions), detail: `${traffic[i]!.recentSessions} sessions in the last 30 days` }
      : { factor: "traffic", score: null, detail: "Google Analytics not connected, or no data for this page" };

    const ctrScore: FactorScore = search[i]
      ? { factor: "ctr", score: percentileRank(ctrValues, search[i]!.recentCtr), detail: `${(search[i]!.recentCtr * 100).toFixed(1)}% CTR in the last 30 days` }
      : { factor: "ctr", score: null, detail: "Search Console not connected, or no data for this page" };

    const internalLinksScore: FactorScore = {
      factor: "internalLinks",
      score: percentileRank(linkCounts, linkCount),
      detail: `${linkCount} internal link${linkCount === 1 ? "" : "s"} point to this page`,
    };

    const conversionRaw = conversions[i] && conversions[i]!.sessions > 0 ? conversions[i]!.conversions / conversions[i]!.sessions : conversions[i] ? 0 : null;
    const conversionScore: FactorScore =
      conversionRaw === null
        ? { factor: "conversion", score: null, detail: "Google Analytics not connected, or no session data for this page" }
        : { factor: "conversion", score: percentileRank(conversionRates, conversionRaw), detail: `${(conversionRaw * 100).toFixed(2)}% of sessions converted in the last 30 days` };

    const factors: FactorScore[] = [
      scoreFreshness(item),
      trafficScore,
      await scoreRanking(item.path),
      ctrScore,
      internalLinksScore,
      scoreSeoCompleteness(item),
      scoreSearchIntent(item),
      conversionScore,
    ];

    const scored = factors.filter((f) => f.score !== null);
    const overallScore = scored.length > 0 ? Math.round(scored.reduce((sum, f) => sum + f.score!, 0) / scored.length) : 0;

    results.push({ contentType: item.contentType, contentId: item.contentId, overallScore, grade: gradeFromScore(overallScore), factors });
  }

  return results;
}
