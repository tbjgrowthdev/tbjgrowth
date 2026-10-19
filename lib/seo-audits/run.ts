import prisma from "@/lib/prisma";
import { getAuditableContent } from "./content-fetch";
import { checkTitles, checkMeta, checkH1, checkNoindex, checkThinContent, checkMissingAlt, checkSchema, checkOrphans } from "./checks";
import { SEO_AUDIT_CATEGORIES, type SeoAuditFinding } from "./types";
import { scanCanonicalAndHreflang } from "@/lib/canonical-hreflang";
import { analyzeRedirects } from "@/lib/redirect-analysis";
import { getLatestLinkCheckRun, type LinkCheckFinding } from "@/lib/link-monitor";
import { sendSeoAuditNotification } from "@/lib/email";

/**
 * Runs all 14 Automated SEO Audit categories and persists the result.
 * Missing/duplicate title & meta, H1 issues, noindex issues, thin content,
 * missing alt, schema problems, and orphan pages are computed fresh here.
 * Canonical Errors, Redirect Problems, and Broken Links deliberately reuse
 * already-built scans (lib/canonical-hreflang.ts, lib/redirect-analysis.ts,
 * and the latest nightly lib/link-monitor.ts run) rather than
 * re-implementing or re-crawling the site a second time in the same run.
 */
export async function runSeoAudit(triggeredBy: "cron" | "manual" = "manual") {
  const startedAt = new Date();
  const items = await getAuditableContent();

  const findings: SeoAuditFinding[] = [
    ...checkTitles(items),
    ...checkMeta(items),
    ...checkH1(items),
    ...checkNoindex(items),
    ...checkThinContent(items),
    ...checkMissingAlt(items),
    ...checkSchema(items),
    ...checkOrphans(items),
  ];

  const canonicalReport = await scanCanonicalAndHreflang();
  for (const issue of canonicalReport.canonicalIssues) {
    findings.push({
      category: "Canonical Errors",
      contentType: issue.contentType,
      contentId: issue.contentId,
      title: issue.title,
      path: issue.path,
      detail: issue.detail,
    });
  }

  const redirectIssues = await analyzeRedirects();
  for (const issue of redirectIssues) {
    findings.push({ category: "Redirect Problems", path: issue.sources[0], detail: issue.description });
  }

  const latestLinkRun = await getLatestLinkCheckRun();
  if (latestLinkRun) {
    const linkFindings: LinkCheckFinding[] = JSON.parse(latestLinkRun.findings);
    for (const f of linkFindings) {
      if (f.category === "Internal 404" || f.category === "External Broken Link") {
        const detailParts = [f.description, f.status !== undefined ? `Status: ${f.status}` : null, f.foundIn?.length ? `Found in: ${f.foundIn.join(", ")}` : null].filter(
          Boolean
        );
        findings.push({ category: "Broken Links", path: f.path, detail: detailParts.join(" — ") || "Broken link." });
      }
    }
  }

  const categoryCounts: Record<string, number> = {};
  for (const category of SEO_AUDIT_CATEGORIES) categoryCounts[category] = 0;
  for (const f of findings) categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;

  const run = await prisma.seoAuditRun.create({
    data: {
      triggeredBy,
      startedAt,
      completedAt: new Date(),
      totalFindings: findings.length,
      categoryCounts: JSON.stringify(categoryCounts),
      findings: JSON.stringify(findings),
    },
  });

  if (findings.length > 0) {
    const settings = await prisma.siteSetting.findFirst();
    await sendSeoAuditNotification({ findingCount: findings.length, categoryCounts, notifyEmail: settings?.email });
  }

  return run;
}

export async function getLatestSeoAuditRun() {
  return prisma.seoAuditRun.findFirst({ orderBy: { startedAt: "desc" } });
}

export async function getSeoAuditHistory(limit = 20) {
  return prisma.seoAuditRun.findMany({ orderBy: { startedAt: "desc" }, take: limit });
}
