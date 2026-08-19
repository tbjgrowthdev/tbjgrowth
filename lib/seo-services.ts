/**
 * SEO & Analytics Services Integrations
 */

import { getValidAccessToken, getGoogleIntegration } from "@/lib/google-oauth";

// --- DataForSEO (Rank Tracking) ---
type RankResult = { position: number | null; resultUrl: string | null };

/**
 * Checks a keyword's Google (UK, en) organic ranking for the site's own domain
 * using DataForSEO's Live Advanced SERP endpoint. Returns null on any failure
 * (missing credentials, API error, network issue) rather than throwing, so a
 * failed check doesn't crash the admin UI — just shows as "unable to check".
 */
export const fetchKeywordRankings = async (keyword: string): Promise<RankResult | null> => {
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
          location_code: 2826, // United Kingdom
          language_code: "en",
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
