/**
 * SEO & Analytics Services Integrations
 */

import { getValidAccessToken, getGoogleIntegration } from "@/lib/google-oauth";

// --- DataForSEO (Rank Tracking) ---
type RankResult = { position: number | null; resultUrl: string | null };

// This site's three target markets (see the keyword tracker's country field
// and the i18n locale plan) — DataForSEO accepts a location_name string for
// every endpoint below, so there's no numeric location_code table to keep in
// sync. Unknown codes fall back to the UK, the site's primary market.
const DATAFORSEO_LOCATION_NAMES: Record<string, string> = {
  GB: "United Kingdom",
  BD: "Bangladesh",
  AE: "United Arab Emirates",
};

function resolveLocationName(country: string): string {
  return DATAFORSEO_LOCATION_NAMES[country] || DATAFORSEO_LOCATION_NAMES.GB;
}

/**
 * Checks a keyword's Google organic ranking (for the given market/language)
 * for the site's own domain, using DataForSEO's Live Advanced SERP endpoint.
 * Returns null on any failure (missing credentials, API error, network
 * issue) rather than throwing, so a failed check doesn't crash the admin UI
 * — just shows as "unable to check".
 */
export const fetchKeywordRankings = async (keyword: string, country: string = "GB", language: string = "en"): Promise<RankResult | null> => {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

  if (!login || !password) {
    console.error("DataForSEO credentials not configured");
    return null;
  }

  const targetDomain = new URL(baseUrl).hostname.replace(/^www\./, "");
  const auth = Buffer.from(`${login}:${password}`).toString("base64");

  try {
    const res = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keyword,
          location_name: resolveLocationName(country),
          language_code: language,
          device: "desktop",
          depth: 100,
        },
      ]),
    });

    if (!res.ok) {
      console.error(`DataForSEO request failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const items = data?.tasks?.[0]?.result?.[0]?.items || [];

    const match = items.find(
      (item: any) => item.type === "organic" && typeof item.domain === "string" && item.domain.replace(/^www\./, "").includes(targetDomain)
    );

    return {
      position: match?.rank_absolute ?? null,
      resultUrl: match?.url ?? null,
    };
  } catch (error) {
    console.error("DataForSEO API call failed:", error);
    return null;
  }
};

// --- DataForSEO (SERP overview + keyword volume, for the AI content pipeline) ---
export type SerpOverviewItem = { position: number; title: string; description: string | null; url: string; domain: string };

/**
 * Top organic results for a keyword — the content pipeline's "Research"
 * stage reasons over these titles/snippets (what's already ranking, what
 * angles/questions competitors cover) instead of fetching live competitor
 * pages, which would need a separate web-search/browsing API this project
 * doesn't have. Same endpoint as fetchKeywordRankings, just returning the
 * result set instead of searching it for one domain.
 */
export async function fetchSerpOverview(keyword: string, limit = 10): Promise<SerpOverviewItem[] | null> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    console.error("DataForSEO credentials not configured");
    return null;
  }
  const auth = Buffer.from(`${login}:${password}`).toString("base64");

  try {
    const res = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ keyword, location_code: 2826, language_code: "en", device: "desktop", depth: limit }]),
    });
    if (!res.ok) {
      console.error(`DataForSEO SERP overview request failed: ${res.status}`);
      return null;
    }
    type RawSerpItem = { type?: string; rank_absolute?: number; title?: string; description?: string | null; url?: string; domain?: string };
    const data = await res.json();
    const items: RawSerpItem[] = data?.tasks?.[0]?.result?.[0]?.items || [];
    return items
      .filter((item) => item.type === "organic")
      .slice(0, limit)
      .map((item) => ({
        position: item.rank_absolute ?? 0,
        title: item.title ?? "",
        description: item.description ?? null,
        url: item.url ?? "",
        domain: item.domain ?? "",
      }));
  } catch (error) {
    console.error("DataForSEO SERP overview call failed:", error);
    return null;
  }
}

export type KeywordVolume = { keyword: string; searchVolume: number | null; competition: number | null; cpc: number | null };

/**
 * Real search-volume/competition/CPC for up to 20 candidate keywords in one
 * call — the "Search Intent" stage uses this to ground the AI's proposed
 * primary/secondary keywords in actual demand data rather than the model's
 * own (frequently wrong) guess at how popular a phrase is.
 */
export async function fetchSearchVolume(keywords: string[]): Promise<KeywordVolume[] | null> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    console.error("DataForSEO credentials not configured");
    return null;
  }
  if (keywords.length === 0) return [];
  const auth = Buffer.from(`${login}:${password}`).toString("base64");

  try {
    const res = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ keywords: keywords.slice(0, 20), location_code: 2826, language_code: "en" }]),
    });
    if (!res.ok) {
      console.error(`DataForSEO search volume request failed: ${res.status}`);
      return null;
    }
    type RawVolumeItem = { keyword?: string; search_volume?: number; competition?: number; cpc?: number };
    const data = await res.json();
    const items: RawVolumeItem[] = data?.tasks?.[0]?.result || [];
    return items.map((item) => ({
      keyword: item.keyword ?? "",
      searchVolume: item.search_volume ?? null,
      competition: item.competition ?? null,
      cpc: item.cpc ?? null,
    }));
  } catch (error) {
    console.error("DataForSEO search volume call failed:", error);
    return null;
  }
}

export type KeywordDifficultyResult = { keyword: string; difficulty: number | null };

/**
 * 0-100 DataForSEO Labs keyword difficulty score for up to 1000 keywords in
 * one call. Kept separate from fetchSearchVolume (a different API product
 * under DataForSEO Labs, not the Google Ads keywords_data product) so a
 * caller that only wants one metric doesn't pay for the other.
 */
export async function fetchKeywordDifficulty(keywords: string[], country: string = "GB", language: string = "en"): Promise<KeywordDifficultyResult[] | null> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    console.error("DataForSEO credentials not configured");
    return null;
  }
  if (keywords.length === 0) return [];
  const auth = Buffer.from(`${login}:${password}`).toString("base64");

  try {
    const res = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/bulk_keyword_difficulty/live", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ keywords: keywords.slice(0, 1000), location_name: resolveLocationName(country), language_code: language }]),
    });
    if (!res.ok) {
      console.error(`DataForSEO keyword difficulty request failed: ${res.status}`);
      return null;
    }
    type RawDifficultyItem = { keyword?: string; keyword_difficulty?: number };
    const data = await res.json();
    const items: RawDifficultyItem[] = data?.tasks?.[0]?.result?.[0]?.items || [];
    return items.map((item) => ({ keyword: item.keyword ?? "", difficulty: item.keyword_difficulty ?? null }));
  } catch (error) {
    console.error("DataForSEO keyword difficulty call failed:", error);
    return null;
  }
}

// --- Google Analytics (GA4) ---
type GA4Traffic = {
  sessions: number;
  activeUsers: number;
  pageViews: number;
  dailySessions: { date: string; sessions: number }[];
};

/** Last-30-days totals + a daily sessions series for the configured GA4 property. Null if not connected/configured. */
export const fetchGA4Traffic = async (): Promise<GA4Traffic | null> => {
  const integration = await getGoogleIntegration();
  if (!integration?.ga4PropertyId) return null;

  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  try {
    const [totalsRes, dailyRes] = await Promise.all([
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${integration.ga4PropertyId}:runReport`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
          metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "screenPageViews" }],
        }),
      }),
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${integration.ga4PropertyId}:runReport`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
          dimensions: [{ name: "date" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ dimension: { dimensionName: "date" } }],
        }),
      }),
    ]);

    if (!totalsRes.ok || !dailyRes.ok) {
      console.error("GA4 request failed:", totalsRes.status, dailyRes.status);
      return null;
    }

    const totals = await totalsRes.json();
    const daily = await dailyRes.json();

    const row = totals.rows?.[0]?.metricValues;
    const dailySessions = (daily.rows || []).map((r: any) => ({
      date: r.dimensionValues[0].value,
      sessions: Number(r.metricValues[0].value),
    }));

    return {
      sessions: Number(row?.[0]?.value || 0),
      activeUsers: Number(row?.[1]?.value || 0),
      pageViews: Number(row?.[2]?.value || 0),
      dailySessions,
    };
  } catch (error) {
    console.error("GA4 API call failed:", error);
    return null;
  }
};


export type GA4LandingPageRow = { date: string; landingPage: string; sessions: number; engagedSessions: number; conversions: number };

/**
 * Every (date, landing page) combination for the Organic Search channel in
 * the given range — the SEO -> Traffic -> Conversion dataset the GA4
 * Analytics Integration import needs. Filtered to
 * sessionDefaultChannelGroup == "Organic Search" so it reflects SEO-driven
 * traffic specifically, not paid/social/direct/referral — unlike
 * fetchGA4Traffic above, which is unfiltered site-wide totals. Capped at a
 * 10,000-row single request (no pagination loop), same scope cut as
 * fetchSearchConsoleRows's 25,000-row cap.
 */
export async function fetchGA4LandingPageRows(startDate: string, endDate: string): Promise<GA4LandingPageRow[] | null> {
  const integration = await getGoogleIntegration();
  if (!integration?.ga4PropertyId) return null;
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  try {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${integration.ga4PropertyId}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }, { name: "landingPage" }],
        metrics: [{ name: "sessions" }, { name: "engagedSessions" }, { name: "conversions" }],
        dimensionFilter: {
          filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { value: "Organic Search", matchType: "EXACT" } },
        },
        limit: 10000,
      }),
    });
    if (!res.ok) {
      console.error(`GA4 landing page import request failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    type Row = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };
    const rows: Row[] = data.rows || [];
    return rows.map((r) => ({
      date: r.dimensionValues?.[0]?.value ?? "",
      landingPage: r.dimensionValues?.[1]?.value ?? "",
      sessions: Number(r.metricValues?.[0]?.value || 0),
      engagedSessions: Number(r.metricValues?.[1]?.value || 0),
      conversions: Number(r.metricValues?.[2]?.value || 0),
    }));
  } catch (error) {
    console.error("GA4 landing page import call failed:", error);
    return null;
  }
}

// --- Google Search Console ---
type GSCStats = { clicks: number; impressions: number; ctr: number; position: number };

/** Last-30-days aggregate Search Console stats for the configured verified site. Null if not connected/configured. */
export const fetchGSCClicks = async (): Promise<GSCStats | null> => {
  const integration = await getGoogleIntegration();
  if (!integration?.gscSiteUrl) return null;

  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(integration.gscSiteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: fmt(startDate), endDate: fmt(endDate) }),
      }
    );

    if (!res.ok) {
      console.error(`GSC request failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const row = data.rows?.[0];

    return {
      clicks: row?.clicks ?? 0,
      impressions: row?.impressions ?? 0,
      ctr: row?.ctr ?? 0,
      position: row?.position ?? 0,
    };
  } catch (error) {
    console.error("GSC API call failed:", error);
    return null;
  }
};

export type SearchQueryStat = { query: string; clicks: number; impressions: number; ctr: number; position: number };

/**
 * Every query Search Console has impression data for over the last 90
 * days (a longer window than the page-trend functions below — query-level
 * rows are sparser, so 30 days is often too thin to be useful), sorted by
 * impressions descending. The Content Recommendations engine's keyword-gap
 * detection (lib/content-recommendations/) uses this as its raw demand
 * signal: queries people already search that land on the site somehow,
 * cross-referenced against existing content to find ones with nothing
 * written for them yet.
 */
export async function fetchTopSearchQueries(limit = 200): Promise<SearchQueryStat[] | null> {
  const integration = await getGoogleIntegration();
  if (!integration?.gscSiteUrl) return null;
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  try {
    const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(integration.gscSiteUrl)}/searchAnalytics/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: fmt(startDate), endDate: fmt(endDate), dimensions: ["query"], rowLimit: 5000 }),
    });
    if (!res.ok) {
      console.error(`GSC top queries request failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    type Row = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };
    const rows: Row[] = data.rows || [];
    return rows
      .map((r) => ({ query: r.keys?.[0] ?? "", clicks: r.clicks ?? 0, impressions: r.impressions ?? 0, ctr: r.ctr ?? 0, position: r.position ?? 0 }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, limit);
  } catch (error) {
    console.error("GSC top queries call failed:", error);
    return null;
  }
}

export type QueryPageRow = { query: string; page: string; impressions: number; clicks: number };

/**
 * Every (query, page) combination Search Console has impression data for
 * over the last 90 days, filtered to a minimum impression floor per row.
 * The Content Cannibalization detector's primary signal: if two different
 * internal pages both show up in this list for the *same* query, Google
 * is already splitting that query's authority between them — the
 * clearest real evidence of cannibalization there is, stronger than any
 * text-similarity heuristic.
 */
export async function fetchQueryPageOverlap(minImpressions = 5): Promise<QueryPageRow[] | null> {
  const integration = await getGoogleIntegration();
  if (!integration?.gscSiteUrl) return null;
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  try {
    const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(integration.gscSiteUrl)}/searchAnalytics/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: fmt(startDate), endDate: fmt(endDate), dimensions: ["query", "page"], rowLimit: 5000 }),
    });
    if (!res.ok) {
      console.error(`GSC query/page overlap request failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    type Row = { keys?: string[]; clicks?: number; impressions?: number };
    const rows: Row[] = data.rows || [];
    return rows
      .map((r) => ({ query: r.keys?.[0] ?? "", page: r.keys?.[1] ?? "", impressions: r.impressions ?? 0, clicks: r.clicks ?? 0 }))
      .filter((r) => r.impressions >= minImpressions);
  } catch (error) {
    console.error("GSC query/page overlap call failed:", error);
    return null;
  }
}

export type SearchConsoleRow = {
  date: string;
  query: string;
  page: string;
  country: string;
  device: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/**
 * Every (date, query, page, country, device) combination Search Console has
 * data for in the given range, in one request — the full dimension set the
 * GSC Integration import needs. Capped at GSC's own single-request maximum
 * of 25,000 rows (no pagination loop here): for a very high-traffic site or
 * a long range, a single import may not capture every row — narrowing the
 * date range gets a more complete pull.
 */
export async function fetchSearchConsoleRows(startDate: string, endDate: string): Promise<SearchConsoleRow[] | null> {
  const integration = await getGoogleIntegration();
  if (!integration?.gscSiteUrl) return null;
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  try {
    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(integration.gscSiteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, dimensions: ["date", "query", "page", "country", "device"], rowLimit: 25000 }),
      }
    );
    if (!res.ok) {
      console.error(`GSC import request failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    type Row = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };
    const rows: Row[] = data.rows || [];
    return rows.map((r) => ({
      date: r.keys?.[0] ?? "",
      query: r.keys?.[1] ?? "",
      page: r.keys?.[2] ?? "",
      country: r.keys?.[3] ?? "",
      device: r.keys?.[4] ?? "",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }));
  } catch (error) {
    console.error("GSC import call failed:", error);
    return null;
  }
}

// --- Per-page trend data, for the Content Refresh Engine's decline detection ---

export type PageTrafficTrend = { recentSessions: number; priorSessions: number };

/**
 * GA4 sessions for one exact page path, last-30-days vs. the 30 days
 * before that — two named date ranges in a single GA4 Data API request
 * (the API supports several dateRanges in one call, distinguished by the
 * "dateRange" dimension in the response), filtered to that one page.
 */
export async function fetchPageTrafficTrend(pagePath: string): Promise<PageTrafficTrend | null> {
  const integration = await getGoogleIntegration();
  if (!integration?.ga4PropertyId) return null;
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  try {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${integration.ga4PropertyId}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [
          { startDate: "30daysAgo", endDate: "today", name: "recent" },
          { startDate: "60daysAgo", endDate: "31daysAgo", name: "prior" },
        ],
        dimensions: [{ name: "pagePath" }, { name: "dateRange" }],
        metrics: [{ name: "sessions" }],
        dimensionFilter: { filter: { fieldName: "pagePath", stringFilter: { value: pagePath, matchType: "EXACT" } } },
      }),
    });
    if (!res.ok) {
      console.error(`GA4 page trend request failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    type Row = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };
    const rows: Row[] = data.rows || [];
    const recent = rows.find((r) => r.dimensionValues?.[1]?.value === "recent");
    const prior = rows.find((r) => r.dimensionValues?.[1]?.value === "prior");
    return { recentSessions: Number(recent?.metricValues?.[0]?.value || 0), priorSessions: Number(prior?.metricValues?.[0]?.value || 0) };
  } catch (error) {
    console.error("GA4 page trend call failed:", error);
    return null;
  }
}

export type PageConversionTrend = { recentConversions: number; priorConversions: number; recentSessions: number; priorSessions: number };

/**
 * Same two-named-dateRanges GA4 request as fetchPageTrafficTrend, just
 * with the conversions metric alongside sessions — used by the Content
 * Refresh Engine's conversion-decline check, which needs last-30-days vs.
 * the 30 days before that rather than fetchPageConversions' single
 * current-window snapshot.
 */
export async function fetchPageConversionTrend(pagePath: string): Promise<PageConversionTrend | null> {
  const integration = await getGoogleIntegration();
  if (!integration?.ga4PropertyId) return null;
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  try {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${integration.ga4PropertyId}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [
          { startDate: "30daysAgo", endDate: "today", name: "recent" },
          { startDate: "60daysAgo", endDate: "31daysAgo", name: "prior" },
        ],
        dimensions: [{ name: "pagePath" }, { name: "dateRange" }],
        metrics: [{ name: "conversions" }, { name: "sessions" }],
        dimensionFilter: { filter: { fieldName: "pagePath", stringFilter: { value: pagePath, matchType: "EXACT" } } },
      }),
    });
    if (!res.ok) {
      console.error(`GA4 page conversion trend request failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    type Row = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };
    const rows: Row[] = data.rows || [];
    const recent = rows.find((r) => r.dimensionValues?.[1]?.value === "recent");
    const prior = rows.find((r) => r.dimensionValues?.[1]?.value === "prior");
    return {
      recentConversions: Number(recent?.metricValues?.[0]?.value || 0),
      priorConversions: Number(prior?.metricValues?.[0]?.value || 0),
      recentSessions: Number(recent?.metricValues?.[1]?.value || 0),
      priorSessions: Number(prior?.metricValues?.[1]?.value || 0),
    };
  } catch (error) {
    console.error("GA4 page conversion trend call failed:", error);
    return null;
  }
}

export type PageConversionStats = { conversions: number; sessions: number };

/**
 * GA4's standard "conversions" metric (counts whatever events are marked
 * as key events in that GA4 property) for one exact page path, last 30
 * days, alongside its sessions for computing a rate. If the property has
 * no key events configured this legitimately returns 0 for every page —
 * that's real data saying "nothing is marked as a conversion here," not
 * a failure, and the Content Health Score (lib/content-health/) treats
 * an all-zero result differently from a null (not connected) result.
 */
export async function fetchPageConversions(pagePath: string): Promise<PageConversionStats | null> {
  const integration = await getGoogleIntegration();
  if (!integration?.ga4PropertyId) return null;
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  try {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${integration.ga4PropertyId}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "conversions" }, { name: "sessions" }],
        dimensionFilter: { filter: { fieldName: "pagePath", stringFilter: { value: pagePath, matchType: "EXACT" } } },
      }),
    });
    if (!res.ok) {
      console.error(`GA4 page conversions request failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    const row = data.rows?.[0];
    return { conversions: Number(row?.metricValues?.[0]?.value || 0), sessions: Number(row?.metricValues?.[1]?.value || 0) };
  } catch (error) {
    console.error("GA4 page conversions call failed:", error);
    return null;
  }
}

export type PageSearchTrend = { recentClicks: number; priorClicks: number; recentCtr: number; priorCtr: number; recentPosition: number; priorPosition: number };

/**
 * GSC clicks/CTR/position for one exact page URL, last-30-days vs. the 30
 * days before that. Unlike GA4's Data API, Search Console's
 * searchAnalytics.query takes exactly one date range per request, so this
 * is two sequential calls rather than one.
 */
export async function fetchPageSearchTrend(pageUrl: string): Promise<PageSearchTrend | null> {
  const integration = await getGoogleIntegration();
  if (!integration?.gscSiteUrl) return null;
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const windowDates = (daysAgoStart: number, daysAgoEnd: number) => {
    const end = new Date();
    end.setDate(end.getDate() - daysAgoEnd);
    const start = new Date();
    start.setDate(start.getDate() - daysAgoStart);
    return { startDate: fmt(start), endDate: fmt(end) };
  };

  async function queryWindow(startDate: string, endDate: string) {
    const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(integration!.gscSiteUrl!)}/searchAnalytics/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "equals", expression: pageUrl }] }],
      }),
    });
    if (!res.ok) {
      console.error(`GSC page trend request failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    const row = data.rows?.[0];
    return { clicks: row?.clicks ?? 0, ctr: row?.ctr ?? 0, position: row?.position ?? 0 };
  }

  try {
    const recentWindow = windowDates(30, 0);
    const priorWindow = windowDates(60, 31);
    const [recent, prior] = await Promise.all([queryWindow(recentWindow.startDate, recentWindow.endDate), queryWindow(priorWindow.startDate, priorWindow.endDate)]);
    if (!recent || !prior) return null;
    return { recentClicks: recent.clicks, priorClicks: prior.clicks, recentCtr: recent.ctr, priorCtr: prior.ctr, recentPosition: recent.position, priorPosition: prior.position };
  } catch (error) {
    console.error("GSC page trend call failed:", error);
    return null;
  }
}
