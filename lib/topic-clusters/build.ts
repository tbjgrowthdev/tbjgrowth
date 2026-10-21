import prisma from "@/lib/prisma";
import { tokenize, jaccardSimilarity } from "@/lib/content-pipeline/quality-gate";
import { buildInternalLinkGraph } from "@/lib/link-graph/build";
import type { ClusterContentType, TopicCluster, TopicClusterMember } from "./types";

// Same bar lib/content-cannibalization/detect.ts and lib/orphan-pages/detect.ts
// use for "similar enough to call related" — a starting point, not tuned
// against real outcomes.
const CLUSTER_SIMILARITY_THRESHOLD = 0.3;

type ContentItem = {
  contentType: ClusterContentType;
  path: string;
  title: string;
  topic: string | null;
  tokens: Set<string>;
  wordCount: number;
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function buildItem(contentType: ClusterContentType, path: string, title: string, focusKeyword: string | null, content: string): ContentItem {
  const text = stripHtml(content);
  return {
    contentType,
    path,
    title,
    topic: focusKeyword?.trim() || null,
    tokens: tokenize(`${title} ${focusKeyword || ""} ${text}`),
    wordCount: text ? text.split(/\s+/).length : 0,
  };
}

/** Same published/indexable universe as lib/link-graph/build.ts, so a cluster's members are exactly the pages that can actually appear in its link graph. */
async function getClusterableContent(): Promise<ContentItem[]> {
  const [posts, pages, caseStudies, services] = await Promise.all([
    prisma.post.findMany({ where: { status: "PUBLISHED" }, select: { title: true, slug: true, focusKeyword: true, content: true } }),
    prisma.page.findMany({ where: { status: "PUBLISHED" }, select: { title: true, slug: true, focusKeyword: true, content: true } }),
    prisma.caseStudy.findMany({ where: { status: "PUBLISHED" }, select: { title: true, slug: true, focusKeyword: true, content: true } }),
    prisma.agencyService.findMany({ where: { isIndexable: true }, select: { title: true, slug: true, focusKeyword: true, content: true } }),
  ]);

  return [
    ...posts.map((p) => buildItem("POST", `/blog/${p.slug}`, p.title, p.focusKeyword, p.content)),
    ...pages.map((p) => buildItem("PAGE", `/${p.slug}`, p.title, p.focusKeyword, p.content || "")),
    ...caseStudies.map((c) => buildItem("CASE_STUDY", `/case-studies/${c.slug}`, c.title, c.focusKeyword, c.content)),
    ...services.filter((s) => s.slug).map((s) => buildItem("SERVICE", `/services/${s.slug}`, s.title, s.focusKeyword, s.content || "")),
  ];
}

/** Union-find over every pair at or above CLUSTER_SIMILARITY_THRESHOLD — O(n²), the same tradeoff lib/content-cannibalization/detect.ts already accepts at this site's content volume. Groups of 1 aren't clusters, so they're dropped. */
function groupIntoClusters(items: ContentItem[]): ContentItem[][] {
  const parent = items.map((_, i) => i);
  function find(i: number): number {
    while (parent[i] !== i) i = parent[i];
    return i;
  }
  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (jaccardSimilarity(items[i].tokens, items[j].tokens) >= CLUSTER_SIMILARITY_THRESHOLD) union(i, j);
    }
  }

  const groups = new Map<number, ContentItem[]>();
  for (let i = 0; i < items.length; i++) {
    const root = find(i);
    const group = groups.get(root) ?? [];
    group.push(items[i]);
    groups.set(root, group);
  }
  return Array.from(groups.values()).filter((g) => g.length >= 2);
}

/**
 * Groups published/indexable content into topic clusters by word-overlap
 * similarity (the same primitive content-cannibalization and orphan-pages
 * use), then assigns pillar/cluster/supporting roles from signals already
 * on the content and its real internal link graph — not a separate
 * "intended structure" model:
 *
 *  - Pillar: the group's most substantial page (highest word count, ties
 *    broken by whichever already gets the most inbound links from its own
 *    cluster peers) — the page a pillar/cluster model expects to be the
 *    comprehensive one.
 *  - Cluster content: other members that already link to the pillar in
 *    the live internal link graph.
 *  - Supporting content: members on the same topic that don't yet link up
 *    to the pillar — same "flag the gap, don't invent a fix" posture as
 *    lib/orphan-pages.
 */
export async function buildTopicClusters(): Promise<TopicCluster[]> {
  const items = await getClusterableContent();
  const groups = groupIntoClusters(items);
  const { edges } = await buildInternalLinkGraph();

  const edgeSet = new Set(edges.map((e) => `${e.sourcePath}=>${e.targetPath}`));
  const linksTo = (source: string, target: string) => edgeSet.has(`${source}=>${target}`);

  const clusters: TopicCluster[] = [];
  for (const group of groups) {
    const inboundWithinGroup = (path: string) => group.filter((m) => m.path !== path && linksTo(m.path, path)).length;

    const pillarItem = [...group].sort((a, b) => b.wordCount - a.wordCount || inboundWithinGroup(b.path) - inboundWithinGroup(a.path))[0];

    const toMember = (item: ContentItem, role: TopicClusterMember["role"]): TopicClusterMember => ({
      contentType: item.contentType,
      path: item.path,
      title: item.title,
      topic: item.topic,
      wordCount: item.wordCount,
      role,
      linksToPillar: role === "PILLAR" || linksTo(item.path, pillarItem.path),
    });

    const pillar = toMember(pillarItem, "PILLAR");
    const members = group
      .filter((item) => item.path !== pillarItem.path)
      .map((item) => toMember(item, linksTo(item.path, pillarItem.path) ? "CLUSTER" : "SUPPORTING"))
      .sort((a, b) => Number(b.linksToPillar) - Number(a.linksToPillar) || b.wordCount - a.wordCount);

    clusters.push({ id: pillarItem.path, topic: pillarItem.topic || pillarItem.title, pillar, members });
  }

  return clusters.sort((a, b) => b.members.length - a.members.length);
}
