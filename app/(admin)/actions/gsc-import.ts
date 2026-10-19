"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { importSearchConsoleData } from "@/lib/gsc-import";
import { describeContent } from "@/lib/content-url-mapping";

export async function runGscImport(startDate: string, endDate: string) {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const result = await importSearchConsoleData(startDate, endDate);
    if ("error" in result) {
      return { success: false, error: result.error };
    }
    revalidatePath("/admin/gsc-import");
    await logAudit({
      action: "import",
      category: "SEO",
      entityType: "SearchConsoleMetric",
      entityLabel: `${startDate} to ${endDate}`,
      after: result,
    });
    return { success: true, result };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to run GSC import:", error);
    return { success: false, error: "Import failed" };
  }
}

export interface GscFilters {
  startDate?: string;
  endDate?: string;
  country?: string;
  device?: string;
}

export interface GscByContentRow {
  contentType: string;
  contentId: string;
  title: string;
  path: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  rows: number;
}

export interface GscUnmappedPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  rows: number;
}

export interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscData {
  byContent: GscByContentRow[];
  unmappedPages: GscUnmappedPageRow[];
  topQueries: GscQueryRow[];
  countries: string[];
  devices: string[];
  totalRows: number;
  lastImportedAt: string | null;
}

function buildWhere(filters: GscFilters) {
  const where: Record<string, unknown> = {};
  if (filters.startDate || filters.endDate) {
    where.date = {
      ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
      ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
    };
  }
  if (filters.country) where.country = filters.country;
  if (filters.device) where.device = filters.device;
  return where;
}

export async function getGscData(filters: GscFilters): Promise<GscData> {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const where = buildWhere(filters);

    const [mappedGrouped, unmappedGrouped, topQueriesGrouped, countries, devices, totalRows, lastRow] = await Promise.all([
      prisma.searchConsoleMetric.groupBy({
        by: ["contentType", "contentId"],
        where: { ...where, contentId: { not: null } },
        _sum: { clicks: true, impressions: true },
        _avg: { ctr: true, position: true },
        _count: { _all: true },
        orderBy: { _sum: { clicks: "desc" } },
      }),
      prisma.searchConsoleMetric.groupBy({
        by: ["page"],
        where: { ...where, contentId: null },
        _sum: { clicks: true, impressions: true },
        _avg: { ctr: true, position: true },
        _count: { _all: true },
        orderBy: { _sum: { clicks: "desc" } },
        take: 50,
      }),
      prisma.searchConsoleMetric.groupBy({
        by: ["query"],
        where,
        _sum: { clicks: true, impressions: true },
        _avg: { ctr: true, position: true },
        orderBy: { _sum: { clicks: "desc" } },
        take: 50,
      }),
      prisma.searchConsoleMetric.findMany({ distinct: ["country"], select: { country: true }, orderBy: { country: "asc" } }),
      prisma.searchConsoleMetric.findMany({ distinct: ["device"], select: { device: true }, orderBy: { device: "asc" } }),
      prisma.searchConsoleMetric.count({ where }),
      prisma.searchConsoleMetric.findFirst({ orderBy: { importedAt: "desc" }, select: { importedAt: true } }),
    ]);

    const contentDescriptions = await describeContent(
      mappedGrouped.map((g) => ({ contentType: g.contentType as string, contentId: g.contentId as string }))
    );

    const byContent: GscByContentRow[] = mappedGrouped.map((g) => {
      const key = `${g.contentType}:${g.contentId}`;
      const described = contentDescriptions.get(key);
      return {
        contentType: g.contentType as string,
        contentId: g.contentId as string,
        title: described?.title || "(deleted content)",
        path: described?.path || "—",
        clicks: g._sum.clicks ?? 0,
        impressions: g._sum.impressions ?? 0,
        ctr: g._avg.ctr ?? 0,
        position: g._avg.position ?? 0,
        rows: g._count._all,
      };
    });

    const unmappedPages: GscUnmappedPageRow[] = unmappedGrouped.map((g) => ({
      page: g.page,
      clicks: g._sum.clicks ?? 0,
      impressions: g._sum.impressions ?? 0,
      ctr: g._avg.ctr ?? 0,
      position: g._avg.position ?? 0,
      rows: g._count._all,
    }));

    const topQueries: GscQueryRow[] = topQueriesGrouped.map((g) => ({
      query: g.query,
      clicks: g._sum.clicks ?? 0,
      impressions: g._sum.impressions ?? 0,
      ctr: g._avg.ctr ?? 0,
      position: g._avg.position ?? 0,
    }));

    return {
      byContent,
      unmappedPages,
      topQueries,
      countries: countries.map((c) => c.country),
      devices: devices.map((d) => d.device),
      totalRows,
      lastImportedAt: lastRow?.importedAt.toISOString() ?? null,
    };
  } catch (error) {
    console.error("Failed to fetch GSC data:", error);
    return { byContent: [], unmappedPages: [], topQueries: [], countries: [], devices: [], totalRows: 0, lastImportedAt: null };
  }
}
