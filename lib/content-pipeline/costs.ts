import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";

export type CostSummary = {
  totalCost: number;
  totalTokens: number;
  unknownCostJobCount: number;
  dailyCost: { date: string; cost: number }[];
  monthlyCost: { month: string; cost: number }[];
  costByModel: { provider: string; model: string; cost: number; tokens: number; jobCount: number }[];
  costByContentType: { contentType: string; cost: number; jobCount: number }[];
};

// Aggregated in JS rather than a SQL GROUP BY — same tradeoff
// lib/content-search.ts already makes for this app's content volume
// (dozens to low hundreds of jobs, not millions), and it keeps the
// per-bucket logic (date/month keys, provider:model grouping) in one
// readable place instead of several raw queries.
export async function getCostSummary(): Promise<CostSummary | null> {
  try {
    await requirePermission("CREATE");
  } catch {
    return null;
  }

  const priced = await prisma.aiJob.findMany({
    where: { costUsd: { not: null } },
    select: {
      costUsd: true,
      totalTokens: true,
      provider: true,
      model: true,
      completedAt: true,
      queuedAt: true,
      pipelineRun: { select: { contentType: true } },
      contentRefresh: { select: { contentType: true } },
    },
  });

  // Completed/failed jobs that DID record token usage but have no cost
  // because their model isn't in lib/content-pipeline/pricing.ts's rate
  // table — surfaced separately so the dashboard never implies these
  // jobs cost nothing, only that their cost is unknown.
  const unknownCostJobCount = await prisma.aiJob.count({
    where: { costUsd: null, totalTokens: { not: null }, status: { in: ["COMPLETED", "FAILED"] } },
  });

  const dailyMap = new Map<string, number>();
  const monthlyMap = new Map<string, number>();
  const modelMap = new Map<string, { provider: string; model: string; cost: number; tokens: number; jobCount: number }>();
  const typeMap = new Map<string, { cost: number; jobCount: number }>();
  let totalCost = 0;
  let totalTokens = 0;

  for (const job of priced) {
    const cost = job.costUsd ?? 0;
    const tokens = job.totalTokens ?? 0;
    const when = job.completedAt ?? job.queuedAt;
    const dateKey = when.toISOString().slice(0, 10);
    const monthKey = when.toISOString().slice(0, 7);

    dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + cost);
    monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + cost);

    const modelKey = `${job.provider}:${job.model}`;
    const modelEntry = modelMap.get(modelKey) ?? { provider: job.provider, model: job.model, cost: 0, tokens: 0, jobCount: 0 };
    modelEntry.cost += cost;
    modelEntry.tokens += tokens;
    modelEntry.jobCount += 1;
    modelMap.set(modelKey, modelEntry);

    const contentType = job.pipelineRun?.contentType ?? job.contentRefresh?.contentType ?? "UNKNOWN";
    const typeEntry = typeMap.get(contentType) ?? { cost: 0, jobCount: 0 };
    typeEntry.cost += cost;
    typeEntry.jobCount += 1;
    typeMap.set(contentType, typeEntry);

    totalCost += cost;
    totalTokens += tokens;
  }

  const dailyCost = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, cost]) => ({ date, cost }));
  const monthlyCost = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, cost]) => ({ month, cost }));
  const costByModel = [...modelMap.values()].sort((a, b) => b.cost - a.cost);
  const costByContentType = [...typeMap.entries()]
    .map(([contentType, v]) => ({ contentType, ...v }))
    .sort((a, b) => b.cost - a.cost);

  return { totalCost, totalTokens, unknownCostJobCount, dailyCost, monthlyCost, costByModel, costByContentType };
}
