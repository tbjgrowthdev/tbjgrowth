import prisma from "@/lib/prisma";
import { analyzeRedirects } from "@/lib/redirect-analysis";
import { sendLinkCheckNotification } from "@/lib/email";

export type LinkCheckFinding = {
  category: "Internal 404" | "External Broken Link" | "Redirect Chain" | "Redirect Loop";
  path: string;
  status?: number | "error" | "timeout";
  foundIn?: string[];
  description?: string;
};

type ContentItem = { label: string; content: string | null };

async function getAllContent(): Promise<ContentItem[]> {
  const [posts, pages, cases, services] = await Promise.all([
    prisma.post.findMany({ where: { status: "PUBLISHED" }, select: { title: true, content: true } }),
    prisma.page.findMany({ where: { status: "PUBLISHED" }, select: { title: true, content: true } }),
    prisma.caseStudy.findMany({ where: { status: "PUBLISHED" }, select: { title: true, content: true } }),
    prisma.agencyService.findMany({ where: { isIndexable: true }, select: { title: true, content: true } }),
  ]);

  return [
    ...posts.map((p) => ({ label: `Blog post: ${p.title}`, content: p.content })),
    ...pages.map((p) => ({ label: `Page: ${p.title}`, content: p.content })),
    ...cases.map((c) => ({ label: `Case study: ${c.title}`, content: c.content })),
    ...services.map((s) => ({ label: `Service: ${s.title}`, content: s.content })),
  ];
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(url: string, timeoutMs: number): Promise<number | "error" | "timeout"> {
  try {
    const res = await fetchWithTimeout(url, { method: "HEAD", redirect: "manual" }, timeoutMs);
    // Some servers don't support HEAD and respond 405 even though GET would
    // work fine — retry once with GET before calling it broken.
    if (res.status === 405) {
      const retry = await fetchWithTimeout(url, { method: "GET", redirect: "manual" }, timeoutMs);
      return retry.status;
    }
    return res.status;
  } catch (error: any) {
    return error?.name === "AbortError" ? "timeout" : "error";
  }
}

async function checkUrlsConcurrently(urls: string[], timeoutMs: number, concurrency = 5) {
  const results: { url: string; status: number | "error" | "timeout" }[] = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(async (url) => ({ url, status: await checkUrl(url, timeoutMs) })));
    results.push(...batchResults);
  }
  return results;
}

function isBroken(status: number | "error" | "timeout") {
  return status === "error" || status === "timeout" || (typeof status === "number" && status >= 400);
}

// Caps on how much a single run checks — bounds execution time since this
// may run inside a cron function with a duration limit, and external sites
// can be slow or hang regardless of our own timeout.
const MAX_EXTERNAL_LINKS = 50;
const EXTERNAL_TIMEOUT_MS = 8000;
const INTERNAL_TIMEOUT_MS = 5000;

export async function runLinkCheck(triggeredBy: "cron" | "manual" = "manual") {
  const startedAt = new Date();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";
  const baseHost = new URL(baseUrl).host;

  const items = await getAllContent();

  const internalSources = new Map<string, Set<string>>();
  const externalSources = new Map<string, Set<string>>();
  const internalPattern = /href="(\/[^"#]*)"/g;
  const absolutePattern = /href="(https?:\/\/[^"]*)"/g;

  for (const item of items) {
    if (!item.content) continue;

    for (const m of item.content.matchAll(internalPattern)) {
      if (!internalSources.has(m[1])) internalSources.set(m[1], new Set());
      internalSources.get(m[1])!.add(item.label);
    }

    for (const m of item.content.matchAll(absolutePattern)) {
      const url = m[1];
      let host: string;
      try {
        host = new URL(url).host;
      } catch {
        continue;
      }
      // An absolute link to our own domain is still an internal link —
      // route it through the internal checker/timeout, not the external one.
      const target = host === baseHost ? new URL(url).pathname : null;
      if (target) {
        if (!internalSources.has(target)) internalSources.set(target, new Set());
        internalSources.get(target)!.add(item.label);
      } else {
        if (!externalSources.has(url)) externalSources.set(url, new Set());
        externalSources.get(url)!.add(item.label);
      }
    }
  }

  const findings: LinkCheckFinding[] = [];

  const internalPaths = Array.from(internalSources.keys());
  const internalResults = await checkUrlsConcurrently(internalPaths.map((p) => `${baseUrl}${p}`), INTERNAL_TIMEOUT_MS);
  let internalBroken = 0;
  for (const r of internalResults) {
    if (isBroken(r.status)) {
      internalBroken++;
      const path = r.url.slice(baseUrl.length);
      findings.push({ category: "Internal 404", path, status: r.status, foundIn: Array.from(internalSources.get(path) ?? []) });
    }
  }

  const externalUrls = Array.from(externalSources.keys()).slice(0, MAX_EXTERNAL_LINKS);
  const externalResults = await checkUrlsConcurrently(externalUrls, EXTERNAL_TIMEOUT_MS);
  let externalBroken = 0;
  for (const r of externalResults) {
    if (isBroken(r.status)) {
      externalBroken++;
      findings.push({ category: "External Broken Link", path: r.url, status: r.status, foundIn: Array.from(externalSources.get(r.url) ?? []) });
    }
  }

  const redirectIssues = await analyzeRedirects();
  let redirectIssueCount = 0;
  for (const issue of redirectIssues) {
    if (issue.type === "chain" || issue.type === "loop") {
      redirectIssueCount++;
      findings.push({
        category: issue.type === "chain" ? "Redirect Chain" : "Redirect Loop",
        path: issue.sources[0],
        description: issue.description,
      });
    }
  }

  const run = await prisma.linkCheckRun.create({
    data: {
      triggeredBy,
      startedAt,
      completedAt: new Date(),
      internalChecked: internalPaths.length,
      internalBroken,
      externalChecked: externalUrls.length,
      externalBroken,
      redirectIssues: redirectIssueCount,
      findings: JSON.stringify(findings),
    },
  });

  if (findings.length > 0) {
    const settings = await prisma.siteSetting.findFirst();
    await sendLinkCheckNotification({ findingCount: findings.length, findings: findings.slice(0, 20), notifyEmail: settings?.email });
  }

  return run;
}

export async function getLatestLinkCheckRun() {
  return prisma.linkCheckRun.findFirst({ orderBy: { startedAt: "desc" } });
}

export async function getLinkCheckHistory(limit = 20) {
  return prisma.linkCheckRun.findMany({ orderBy: { startedAt: "desc" }, take: limit });
}
