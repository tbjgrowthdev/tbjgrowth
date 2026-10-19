"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { fetchKeywordRankings, fetchSearchVolume, fetchKeywordDifficulty } from "@/lib/seo-services";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import type { SearchIntent, KeywordStatus } from "@/lib/generated/prisma/client";

export async function getTrackedKeywords() {
  try {
    await requirePermission("SEO_MANAGEMENT");
    return await prisma.trackedKeyword.findMany({
      include: { rankChecks: { orderBy: { checkedAt: "desc" }, take: 10 } },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch tracked keywords:", error);
    return [];
  }
}

export async function createTrackedKeyword(data: {
  term: string;
  targetUrl?: string;
  searchIntent?: SearchIntent;
  country?: string;
  language?: string;
  status?: KeywordStatus;
}) {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const keyword = await prisma.trackedKeyword.create({
      data: {
        term: data.term.trim(),
        targetUrl: data.targetUrl?.trim() || null,
        searchIntent: data.searchIntent || "INFORMATIONAL",
        country: data.country || "GB",
        language: data.language || "en",
        status: data.status || "ACTIVE",
      },
    });
    revalidatePath("/admin/keywords");
    await logAudit({
      action: "create",
      category: "SEO",
      entityType: "TrackedKeyword",
      entityId: keyword.id,
      entityLabel: keyword.term,
      after: { term: keyword.term, targetUrl: keyword.targetUrl, searchIntent: keyword.searchIntent, country: keyword.country, language: keyword.language, status: keyword.status },
    });
    return { success: true, keyword };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create tracked keyword:", error);
    if (error.code === "P2002") {
      return { success: false, error: "This keyword + target URL combination is already tracked" };
    }
    return { success: false, error: "Failed to add keyword" };
  }
}

export async function updateTrackedKeyword(
  id: string,
  data: { targetUrl?: string; searchIntent?: SearchIntent; country?: string; language?: string; status?: KeywordStatus }
) {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const before = await prisma.trackedKeyword.findUnique({ where: { id } });
    if (!before) {
      return { success: false, error: "Keyword not found" };
    }
    const keyword = await prisma.trackedKeyword.update({
      where: { id },
      data: {
        targetUrl: data.targetUrl !== undefined ? data.targetUrl.trim() || null : undefined,
        searchIntent: data.searchIntent,
        country: data.country,
        language: data.language,
        status: data.status,
      },
    });
    revalidatePath("/admin/keywords");
    await logAudit({
      action: "update",
      category: "SEO",
      entityType: "TrackedKeyword",
      entityId: keyword.id,
      entityLabel: keyword.term,
      before: { targetUrl: before.targetUrl, searchIntent: before.searchIntent, country: before.country, language: before.language, status: before.status },
      after: { targetUrl: keyword.targetUrl, searchIntent: keyword.searchIntent, country: keyword.country, language: keyword.language, status: keyword.status },
    });
    return { success: true, keyword };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to update tracked keyword ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function deleteTrackedKeyword(id: string) {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const before = await prisma.trackedKeyword.findUnique({ where: { id } });
    await prisma.trackedKeyword.delete({ where: { id } });
    revalidatePath("/admin/keywords");
    if (before) {
      await logAudit({
        action: "delete",
        category: "SEO",
        entityType: "TrackedKeyword",
        entityId: id,
        entityLabel: before.term,
        before: { term: before.term, targetUrl: before.targetUrl },
      });
    }
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to delete tracked keyword ${id}:`, error);
    return { success: false, error: error.message };
  }
}

/** Triggers a live DataForSEO rank check for one keyword and records the result. Costs a real API call. */
export async function runRankCheck(trackedKeywordId: string) {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const keyword = await prisma.trackedKeyword.findUnique({ where: { id: trackedKeywordId } });
    if (!keyword) {
      return { success: false, error: "Keyword not found" };
    }

    const result = await fetchKeywordRankings(keyword.term, keyword.country, keyword.language);
    if (result === null) {
      return { success: false, error: "Rank check failed — check DataForSEO credentials" };
    }

    const rankCheck = await prisma.rankCheck.create({
      data: { trackedKeywordId, position: result.position },
    });

    revalidatePath("/admin/keywords");
    return { success: true, rankCheck, resultUrl: result.resultUrl };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to run rank check for ${trackedKeywordId}:`, error);
    return { success: false, error: "Rank check failed" };
  }
}

/**
 * On-demand search volume + difficulty refresh for one keyword. Kept as its
 * own explicit action (same reasoning as "Check Rank") rather than running
 * automatically on create/edit, since every call costs real DataForSEO API
 * credits. Either metric is left untouched (not nulled out) if its half of
 * the DataForSEO call fails, so a transient failure in one never wipes out
 * previously-known data for the other.
 */
export async function refreshKeywordMetrics(trackedKeywordId: string) {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const keyword = await prisma.trackedKeyword.findUnique({ where: { id: trackedKeywordId } });
    if (!keyword) {
      return { success: false, error: "Keyword not found" };
    }

    const [volumes, difficulties] = await Promise.all([
      fetchSearchVolume([keyword.term]),
      fetchKeywordDifficulty([keyword.term], keyword.country, keyword.language),
    ]);

    if (volumes === null && difficulties === null) {
      return { success: false, error: "Metrics refresh failed — check DataForSEO credentials" };
    }

    const searchVolume = volumes?.[0]?.searchVolume ?? keyword.searchVolume;
    const difficulty = difficulties?.[0]?.difficulty ?? keyword.difficulty;

    const updated = await prisma.trackedKeyword.update({
      where: { id: trackedKeywordId },
      data: { searchVolume, difficulty },
    });

    revalidatePath("/admin/keywords");
    return { success: true, keyword: updated };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to refresh metrics for ${trackedKeywordId}:`, error);
    return { success: false, error: "Metrics refresh failed" };
  }
}

export async function getCompetitorDomains() {
  try {
    await requirePermission("SEO_MANAGEMENT");
    return await prisma.competitorDomain.findMany({ orderBy: { createdAt: "desc" } });
  } catch (error) {
    console.error("Failed to fetch competitor domains:", error);
    return [];
  }
}

export async function createCompetitorDomain(data: { domain: string; name?: string; notes?: string }) {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const domain = data.domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!domain) {
      return { success: false, error: "Domain cannot be empty" };
    }

    const competitor = await prisma.competitorDomain.create({
      data: { domain, name: data.name?.trim() || null, notes: data.notes?.trim() || null },
    });
    revalidatePath("/admin/keywords");
    await logAudit({
      action: "create",
      category: "SEO",
      entityType: "CompetitorDomain",
      entityId: competitor.id,
      entityLabel: competitor.domain,
      after: { domain: competitor.domain, name: competitor.name, notes: competitor.notes },
    });
    return { success: true, competitor };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to add competitor domain:", error);
    if (error.code === "P2002") {
      return { success: false, error: "This domain is already tracked" };
    }
    return { success: false, error: "Failed to add competitor domain" };
  }
}

export async function deleteCompetitorDomain(id: string) {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const before = await prisma.competitorDomain.findUnique({ where: { id } });
    await prisma.competitorDomain.delete({ where: { id } });
    revalidatePath("/admin/keywords");
    if (before) {
      await logAudit({
        action: "delete",
        category: "SEO",
        entityType: "CompetitorDomain",
        entityId: id,
        entityLabel: before.domain,
        before: { domain: before.domain, name: before.name, notes: before.notes },
      });
    }
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to delete competitor domain ${id}:`, error);
    return { success: false, error: error.message };
  }
}
