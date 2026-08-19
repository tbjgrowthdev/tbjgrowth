"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { fetchKeywordRankings } from "@/lib/seo-services";

export async function getTrackedKeywords() {
  try {
    return await prisma.trackedKeyword.findMany({
      include: { rankChecks: { orderBy: { checkedAt: "desc" }, take: 10 } },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch tracked keywords:", error);
    return [];
  }
}

export async function createTrackedKeyword(data: { term: string; targetUrl?: string }) {
  try {
    const keyword = await prisma.trackedKeyword.create({
      data: { term: data.term.trim(), targetUrl: data.targetUrl?.trim() || null },
    });
    revalidatePath("/admin/keywords");
    return { success: true, keyword };
  } catch (error: any) {
    console.error("Failed to create tracked keyword:", error);
    if (error.code === "P2002") {
      return { success: false, error: "This keyword + target URL combination is already tracked" };
    }
    return { success: false, error: "Failed to add keyword" };
  }
}

export async function deleteTrackedKeyword(id: string) {
  try {
    await prisma.trackedKeyword.delete({ where: { id } });
    revalidatePath("/admin/keywords");
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to delete tracked keyword ${id}:`, error);
    return { success: false, error: error.message };
  }
}

/** Triggers a live DataForSEO rank check for one keyword and records the result. Costs a real API call. */
export async function runRankCheck(trackedKeywordId: string) {
  try {
    const keyword = await prisma.trackedKeyword.findUnique({ where: { id: trackedKeywordId } });
    if (!keyword) {
      return { success: false, error: "Keyword not found" };
    }

    const result = await fetchKeywordRankings(keyword.term);
    if (result === null) {
      return { success: false, error: "Rank check failed — check DataForSEO credentials" };
    }

    const rankCheck = await prisma.rankCheck.create({
      data: { trackedKeywordId, position: result.position },
    });

    revalidatePath("/admin/keywords");
    return { success: true, rankCheck, resultUrl: result.resultUrl };
  } catch (error: any) {
    console.error(`Failed to run rank check for ${trackedKeywordId}:`, error);
    return { success: false, error: "Rank check failed" };
  }
}

export async function getCompetitorDomains() {
  try {
    return await prisma.competitorDomain.findMany({ orderBy: { createdAt: "desc" } });
  } catch (error) {
    console.error("Failed to fetch competitor domains:", error);
    return [];
  }
}

export async function createCompetitorDomain(data: { domain: string; name?: string; notes?: string }) {
  try {
    const domain = data.domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!domain) {
      return { success: false, error: "Domain cannot be empty" };
    }

    const competitor = await prisma.competitorDomain.create({
      data: { domain, name: data.name?.trim() || null, notes: data.notes?.trim() || null },
    });
    revalidatePath("/admin/keywords");
    return { success: true, competitor };
  } catch (error: any) {
    console.error("Failed to add competitor domain:", error);
    if (error.code === "P2002") {
      return { success: false, error: "This domain is already tracked" };
    }
    return { success: false, error: "Failed to add competitor domain" };
  }
}

export async function deleteCompetitorDomain(id: string) {
  try {
    await prisma.competitorDomain.delete({ where: { id } });
    revalidatePath("/admin/keywords");
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to delete competitor domain ${id}:`, error);
    return { success: false, error: error.message };
  }
}
