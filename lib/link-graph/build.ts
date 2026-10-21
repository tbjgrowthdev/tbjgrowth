import prisma from "@/lib/prisma";
import type { InternalLinkGraph, LinkGraphEdge, LinkGraphNode } from "./types";

type SourceItem = {
  contentType: "POST" | "PAGE" | "CASE_STUDY" | "SERVICE";
  path: string;
  title: string;
  topic: string | null;
  content: string;
};

const LINK_PATTERN = /<a\s+[^>]*href="(\/[^"#]*)"[^>]*>([\s\S]*?)<\/a>/gi;

function normalizePath(path: string): string {
  const bare = path.split("?")[0].split("#")[0];
  return bare.replace(/\/+$/, "") || "/";
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Same content universe lib/link-monitor.ts's getAllContent() checks for
 * broken links — Post/Page/CaseStudy published, Service indexable — so the
 * graph reflects exactly the content whose links are actually live on the
 * site, not draft/unpublished work in progress.
 */
async function getSourceContent(): Promise<SourceItem[]> {
  const [posts, pages, caseStudies, services] = await Promise.all([
    prisma.post.findMany({ where: { status: "PUBLISHED" }, select: { title: true, slug: true, focusKeyword: true, content: true } }),
    prisma.page.findMany({ where: { status: "PUBLISHED" }, select: { title: true, slug: true, focusKeyword: true, content: true } }),
    prisma.caseStudy.findMany({ where: { status: "PUBLISHED" }, select: { title: true, slug: true, focusKeyword: true, content: true } }),
    prisma.agencyService.findMany({ where: { isIndexable: true }, select: { title: true, slug: true, focusKeyword: true, content: true } }),
  ]);

  return [
    ...posts.map((p) => ({ contentType: "POST" as const, path: `/blog/${p.slug}`, title: p.title, topic: p.focusKeyword, content: p.content || "" })),
    ...pages.map((p) => ({ contentType: "PAGE" as const, path: `/${p.slug}`, title: p.title, topic: p.focusKeyword, content: p.content || "" })),
    ...caseStudies.map((c) => ({
      contentType: "CASE_STUDY" as const,
      path: `/case-studies/${c.slug}`,
      title: c.title,
      topic: c.focusKeyword,
      content: c.content || "",
    })),
    ...services
      .filter((s) => s.slug)
      .map((s) => ({ contentType: "SERVICE" as const, path: `/services/${s.slug}`, title: s.title, topic: s.focusKeyword, content: s.content || "" })),
  ];
}

/**
 * Builds the site's internal link graph straight from published/indexable
 * content's own HTML body — the same `href="..."` source link-monitor and
 * orphan-pages read, so this reflects real rendered links rather than a
 * separate "intended links" model. A target path that isn't one of this
 * site's content records (the homepage, a listing page, /contact, etc.)
 * still gets a node — typed OTHER — so the graph accounts for every
 * internal link, not only the ones between editorial content.
 */
export async function buildInternalLinkGraph(): Promise<InternalLinkGraph> {
  const items = await getSourceContent();

  const nodesByPath = new Map<string, LinkGraphNode>();
  for (const item of items) {
    nodesByPath.set(item.path, { path: item.path, contentType: item.contentType, title: item.title, topic: item.topic?.trim() || null });
  }

  const edges = new Map<string, LinkGraphEdge>();

  for (const item of items) {
    for (const m of item.content.matchAll(LINK_PATTERN)) {
      const targetPath = normalizePath(m[1]);
      if (targetPath === item.path) continue; // self-links aren't part of the site's link graph

      if (!nodesByPath.has(targetPath)) {
        nodesByPath.set(targetPath, { path: targetPath, contentType: "OTHER", title: targetPath, topic: null });
      }

      const anchorText = stripTags(m[2]) || "(no text)";
      const key = `${item.path}::${targetPath}`;
      let edge = edges.get(key);
      if (!edge) {
        edge = { sourcePath: item.path, targetPath, anchors: [], linkCount: 0 };
        edges.set(key, edge);
      }
      const anchor = edge.anchors.find((a) => a.text === anchorText);
      if (anchor) anchor.count++;
      else edge.anchors.push({ text: anchorText, count: 1 });
      edge.linkCount++;
    }
  }

  return {
    nodes: Array.from(nodesByPath.values()),
    edges: Array.from(edges.values()).sort((a, b) => b.linkCount - a.linkCount),
  };
}
