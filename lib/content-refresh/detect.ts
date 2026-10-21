import { prisma } from "@/lib/prisma";
import { fetchPageConversionTrend, fetchPageSearchTrend, fetchPageTrafficTrend } from "@/lib/seo-services";
import type { DetectedSignal, RefreshCandidate } from "./types";

// All thresholds here are starting points, not tuned against real traffic
// data — same "pragmatic default, revisit if it's noisy or misses things"
// spirit as every other threshold in this codebase (e.g. the brute-force
// lockout window, the duplicate-content similarity cutoff).
const OLD_CONTENT_DAYS = 180;
const OUTDATED_YEAR_LOOKBACK = 2; // a mentioned year this many+ behind the current one, with no newer year also mentioned, reads as stale
const RANKING_DECLINE_POSITIONS = 5; // position got at least this many spots worse, or vanished entirely
const TRAFFIC_DECLINE_RATIO = 0.7; // recent sessions below 70% of the prior window
const TRAFFIC_DECLINE_MIN_PRIOR = 10; // ignore near-zero-traffic pages — noise, not a real decline
const CTR_DECLINE_RATIO = 0.7;
const CTR_DECLINE_MIN_PRIOR_CLICKS = 5;
const CONVERSION_DECLINE_RATIO = 0.7; // recent conversion rate below 70% of the prior window's
const CONVERSION_DECLINE_MIN_PRIOR_CONVERSIONS = 3; // ignore near-zero-conversion pages — noise, not a real decline

const baseUrl = () => process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

function checkOldContent(publishedAt: Date | null, updatedAt: Date): DetectedSignal | null {
  const reference = publishedAt ?? updatedAt;
  const ageDays = (Date.now() - reference.getTime()) / 86_400_000;
  if (ageDays < OLD_CONTENT_DAYS) return null;
  return { type: "OLD_CONTENT", detail: `Published/updated ${Math.floor(ageDays)} days ago` };
}

function checkOutdatedMentions(contentHtml: string): DetectedSignal | null {
  const currentYear = new Date().getFullYear();
  const years = [...new Set((contentHtml.match(/\b(19|20)\d{2}\b/g) || []).map(Number))];
  if (years.length === 0) return null;
  const newest = Math.max(...years);
  if (currentYear - newest < OUTDATED_YEAR_LOOKBACK) return null; // a recent year is mentioned somewhere — not stale
  const oldYears = years.filter((y) => currentYear - y >= OUTDATED_YEAR_LOOKBACK);
  return { type: "OUTDATED_MENTION", detail: `Mentions ${oldYears.sort().join(", ")} with no more recent year referenced` };
}

async function checkRankingDecline(publicUrl: string): Promise<DetectedSignal | null> {
  const keywords = await prisma.trackedKeyword.findMany({
    where: { targetUrl: publicUrl },
    include: { rankChecks: { orderBy: { checkedAt: "desc" }, take: 2 } },
  });

  for (const keyword of keywords) {
    const [latest, previous] = keyword.rankChecks;
    if (!latest || !previous) continue;
    if (latest.position === null && previous.position !== null) {
      return { type: "RANKING_DECLINE", detail: `"${keyword.term}" dropped out of tracked results (was #${previous.position})` };
    }
    if (latest.position !== null && previous.position !== null && latest.position - previous.position >= RANKING_DECLINE_POSITIONS) {
      return { type: "RANKING_DECLINE", detail: `"${keyword.term}" fell from #${previous.position} to #${latest.position}` };
    }
  }
  return null;
}

async function checkTrafficDecline(publicPath: string): Promise<DetectedSignal | null> {
  const trend = await fetchPageTrafficTrend(publicPath);
  if (!trend || trend.priorSessions < TRAFFIC_DECLINE_MIN_PRIOR) return null;
  if (trend.recentSessions >= trend.priorSessions * TRAFFIC_DECLINE_RATIO) return null;
  const pct = Math.round((1 - trend.recentSessions / trend.priorSessions) * 100);
  return { type: "TRAFFIC_DECLINE", detail: `Sessions down ${pct}% (${trend.priorSessions} → ${trend.recentSessions} over 30 days)` };
}

async function checkCtrDecline(publicUrl: string): Promise<DetectedSignal | null> {
  const trend = await fetchPageSearchTrend(publicUrl);
  if (!trend || trend.priorClicks < CTR_DECLINE_MIN_PRIOR_CLICKS) return null;
  if (trend.priorCtr <= 0 || trend.recentCtr >= trend.priorCtr * CTR_DECLINE_RATIO) return null;
  const pct = Math.round((1 - trend.recentCtr / trend.priorCtr) * 100);
  return { type: "CTR_DECLINE", detail: `CTR down ${pct}% (${(trend.priorCtr * 100).toFixed(1)}% → ${(trend.recentCtr * 100).toFixed(1)}%)` };
}

async function checkConversionDecline(publicPath: string): Promise<DetectedSignal | null> {
  const trend = await fetchPageConversionTrend(publicPath);
  if (!trend || trend.priorConversions < CONVERSION_DECLINE_MIN_PRIOR_CONVERSIONS || trend.priorSessions === 0) return null;
  const priorRate = trend.priorConversions / trend.priorSessions;
  const recentRate = trend.recentSessions > 0 ? trend.recentConversions / trend.recentSessions : 0;
  if (priorRate <= 0 || recentRate >= priorRate * CONVERSION_DECLINE_RATIO) return null;
  const pct = Math.round((1 - recentRate / priorRate) * 100);
  return { type: "CONVERSION_DECLINE", detail: `Conversion rate down ${pct}% (${(priorRate * 100).toFixed(2)}% → ${(recentRate * 100).toFixed(2)}% of sessions over 30 days)` };
}

/**
 * Scans every published Post and CaseStudy for the six signals and
 * returns only the ones with at least one. Read-only — never writes a
 * ContentRefresh row itself; see lib/content-refresh/refresh.ts's
 * upsertDetectedCandidates() for that, so a plain "preview the scan"
 * caller (e.g. a future dry-run) can use this without side effects.
 */
export async function scanForRefreshCandidates(): Promise<RefreshCandidate[]> {
  const [posts, caseStudies] = await Promise.all([
    prisma.post.findMany({ where: { status: "PUBLISHED" } }),
    prisma.caseStudy.findMany({ where: { status: "PUBLISHED" } }),
  ]);

  const items = [
    ...posts.map((p) => ({ contentType: "POST" as const, record: p, path: `/blog/${p.slug}` })),
    ...caseStudies.map((c) => ({ contentType: "CASE_STUDY" as const, record: c, path: `/case-studies/${c.slug}` })),
  ];

  const candidates: RefreshCandidate[] = [];
  for (const item of items) {
    const fullUrl = `${baseUrl()}${item.path}`;
    const [ranking, traffic, ctr, conversion] = await Promise.all([
      checkRankingDecline(item.path),
      checkTrafficDecline(item.path),
      checkCtrDecline(fullUrl),
      checkConversionDecline(item.path),
    ]);
    const signals = [
      checkOldContent(item.record.publishedAt, item.record.updatedAt),
      checkOutdatedMentions(item.record.content),
      ranking,
      traffic,
      ctr,
      conversion,
    ].filter((s): s is DetectedSignal => s !== null);

    if (signals.length > 0) {
      candidates.push({
        contentType: item.contentType,
        contentId: item.record.id,
        title: item.record.title,
        slug: item.record.slug,
        publishedAt: item.record.publishedAt?.toISOString() ?? null,
        signals,
      });
    }
  }

  return candidates;
}
