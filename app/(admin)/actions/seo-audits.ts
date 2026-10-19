"use server";

import { requirePermission, AuthError } from "@/lib/auth-guard";
import { runSeoAudit, getLatestSeoAuditRun, getSeoAuditHistory } from "@/lib/seo-audits/run";
import type { SeoAuditFinding } from "@/lib/seo-audits/types";

export async function triggerSeoAudit() {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const run = await runSeoAudit("manual");
    return {
      success: true,
      run: {
        id: run.id,
        triggeredBy: run.triggeredBy,
        startedAt: run.startedAt,
        totalFindings: run.totalFindings,
        categoryCounts: JSON.parse(run.categoryCounts) as Record<string, number>,
        findings: JSON.parse(run.findings) as SeoAuditFinding[],
      },
    };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to run SEO audit:", error);
    return { success: false, error: "Audit failed" };
  }
}

export async function getSeoAuditData() {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const [latest, history] = await Promise.all([getLatestSeoAuditRun(), getSeoAuditHistory()]);
    return {
      latest: latest
        ? {
            id: latest.id,
            triggeredBy: latest.triggeredBy,
            startedAt: latest.startedAt,
            totalFindings: latest.totalFindings,
            categoryCounts: JSON.parse(latest.categoryCounts) as Record<string, number>,
            findings: JSON.parse(latest.findings) as SeoAuditFinding[],
          }
        : null,
      history: history.map((h) => ({ id: h.id, triggeredBy: h.triggeredBy, startedAt: h.startedAt, totalFindings: h.totalFindings })),
    };
  } catch (error) {
    console.error("Failed to fetch SEO audit data:", error);
    return { latest: null, history: [] };
  }
}
