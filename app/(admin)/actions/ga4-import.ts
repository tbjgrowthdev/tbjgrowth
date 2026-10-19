"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { importGA4AnalyticsData } from "@/lib/ga4-import";
import { describeContent } from "@/lib/content-url-mapping";

export async function runGa4Import(startDate: string, endDate: string) {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const result = await importGA4AnalyticsData(startDate, endDate);
    if ("error" in result) {
      return { success: false, error: result.error };
    }
    revalidatePath("/admin/ga4-import");
    await logAudit({
      action: "import",
      category: "SEO",
      entityType: "AnalyticsLandingPageMetric",
      entityLabel: `${startDate} to ${endDate}`,
      after: result,
    });
    return { success: true, result };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to run GA4 import:", error);
    return { success: false, error: "Import failed" };
  }
}

export interface Ga4Filters {
  startDate?: string;
  endDate?: string;
}

export interface Ga4ByContentRow {
  contentType: string;
  contentId: string;
  title: string;
  path: string;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  conversions: number;
  conversionRate: number;
  rows: number;
}

export interface Ga4UnmappedPageRow {
  landingPage: string;
  sessions: number;
  conversions: number;
  rows: number;
}

export interface Ga4Totals {
  sessions: number;
  engagedSessions: number;
  conversions: number;
  engagementRate: number;
  conversionRate: number;
}

export interface Ga4Data {
  byContent: Ga4ByContentRow[];
  unmappedPages: Ga4UnmappedPageRow[];
  totals: Ga4Totals;
  totalRows: number;
  lastImportedAt: string | null;
}

function buildWhere(filters: Ga4Filters) {
  const where: Record<string, unknown> = {};
  if (filters.startDate || filters.endDate) {
    where.date = {
      ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
      ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
    };
  }
  return where;
}

export async function getGa4Data(filters: Ga4Filters): Promise<Ga4Data> {
  const emptyResult: Ga4Data = {
    byContent: [],
    unmappedPages: [],
    totals: { sessions: 0, engagedSessions: 0, conversions: 0, engagementRate: 0, conversionRate: 0 },
    totalRows: 0,
    lastImportedAt: null,
  };
  try {
    await requirePermission("SEO_MANAGEMENT");
    const where = buildWhere(filters);

    const [mappedGrouped, unmappedGrouped, totalsAgg, totalRows, lastRow] = await Promise.all([
      prisma.analyticsLandingPageMetric.groupBy({
        by: ["contentType", "contentId"],
        where: { ...where, contentId: { not: null } },
        _sum: { sessions: true, engagedSessions: true, conversions: true },
        _count: { _all: true },
        orderBy: { _sum: { sessions: "desc" } },
      }),
      prisma.analyticsLandingPageMetric.groupBy({
        by: ["landingPage"],
        where: { ...where, contentId: null },
        _sum: { sessions: true, conversions: true },
        _count: { _all: true },
        orderBy: { _sum: { sessions: "desc" } },
        take: 50,
      }),
      prisma.analyticsLandingPageMetric.aggregate({
        where,
        _sum: { sessions: true, engagedSessions: true, conversions: true },
      }),
      prisma.analyticsLandingPageMetric.count({ where }),
      prisma.analyticsLandingPageMetric.findFirst({ orderBy: { importedAt: "desc" }, select: { importedAt: true } }),
    ]);

    const contentDescriptions = await describeContent(
      mappedGrouped.map((g) => ({ contentType: g.contentType as string, contentId: g.contentId as string }))
    );

    const byContent: Ga4ByContentRow[] = mappedGrouped.map((g) => {
      const key = `${g.contentType}:${g.contentId}`;
      const described = contentDescriptions.get(key);
      const sessions = g._sum.sessions ?? 0;
      const engagedSessions = g._sum.engagedSessions ?? 0;
      const conversions = g._sum.conversions ?? 0;
      return {
        contentType: g.contentType as string,
        contentId: g.contentId as string,
        title: described?.title || "(deleted content)",
        path: described?.path || "—",
        sessions,
        engagedSessions,
        engagementRate: sessions > 0 ? engagedSessions / sessions : 0,
        conversions,
        conversionRate: sessions > 0 ? conversions / sessions : 0,
        rows: g._count._all,
      };
    });

    const unmappedPages: Ga4UnmappedPageRow[] = unmappedGrouped.map((g) => ({
      landingPage: g.landingPage,
      sessions: g._sum.sessions ?? 0,
      conversions: g._sum.conversions ?? 0,
      rows: g._count._all,
    }));

    const totalSessions = totalsAgg._sum.sessions ?? 0;
    const totalEngaged = totalsAgg._sum.engagedSessions ?? 0;
    const totalConversions = totalsAgg._sum.conversions ?? 0;

    return {
      byContent,
      unmappedPages,
      totals: {
        sessions: totalSessions,
        engagedSessions: totalEngaged,
        conversions: totalConversions,
        engagementRate: totalSessions > 0 ? totalEngaged / totalSessions : 0,
        conversionRate: totalSessions > 0 ? totalConversions / totalSessions : 0,
      },
      totalRows,
      lastImportedAt: lastRow?.importedAt.toISOString() ?? null,
    };
  } catch (error) {
    console.error("Failed to fetch GA4 data:", error);
    return emptyResult;
  }
}
