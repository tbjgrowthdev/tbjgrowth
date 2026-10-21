"use client";

import { useMemo, useState } from "react";
import type { getInternalLinkGraphAction } from "@/app/(admin)/actions/link-graph";
import type { LinkGraphContentType, LinkGraphNode } from "@/lib/link-graph/types";

type Result = Awaited<ReturnType<typeof getInternalLinkGraphAction>>;

const TYPE_LABEL: Record<LinkGraphContentType, string> = {
  POST: "Blog Post",
  PAGE: "Page",
  CASE_STUDY: "Case Study",
  SERVICE: "Service",
  OTHER: "Other",
};

// Fixed hex values (not Tailwind color classes) because the same colors are
// reused as SVG stroke/fill attributes, which can't resolve CSS utility
// classes.
const TYPE_COLOR: Record<LinkGraphContentType, string> = {
  POST: "#f97316",
  PAGE: "#3b82f6",
  CASE_STUDY: "#8b5cf6",
  SERVICE: "#10b981",
  OTHER: "#9ca3af",
};

const SIZE = 760;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 90;

function layoutNodes(nodes: LinkGraphNode[]) {
  // Grouped by content type around the circle (rather than insertion order)
  // so same-type pages cluster together and the color grouping is visible
  // at a glance instead of scattered.
  const ordered = [...nodes].sort((a, b) => a.contentType.localeCompare(b.contentType) || a.title.localeCompare(b.title));
  return ordered.map((node, i) => {
    const angle = (2 * Math.PI * i) / Math.max(ordered.length, 1) - Math.PI / 2;
    return { node, x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle), angle };
  });
}

export default function LinkGraphClient({ result }: { result: Result }) {
  const [hoverPath, setHoverPath] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<LinkGraphContentType | "ALL">("ALL");
  const [search, setSearch] = useState("");

  const { nodes, edges } = result.success ? result.data : { nodes: [], edges: [] };
  const positioned = useMemo(() => layoutNodes(nodes), [nodes]);
  const positionByPath = useMemo(() => new Map(positioned.map((p) => [p.node.path, p])), [positioned]);
  const maxLinkCount = useMemo(() => Math.max(1, ...edges.map((e) => e.linkCount)), [edges]);

  const filteredEdges = useMemo(() => {
    const q = search.trim().toLowerCase();
    return edges.filter((e) => {
      const targetNode = positionByPath.get(e.targetPath)?.node;
      if (typeFilter !== "ALL" && targetNode?.contentType !== typeFilter) return false;
      if (!q) return true;
      const anchorText = e.anchors.map((a) => a.text).join(" ").toLowerCase();
      return e.sourcePath.toLowerCase().includes(q) || e.targetPath.toLowerCase().includes(q) || anchorText.includes(q);
    });
  }, [edges, typeFilter, search, positionByPath]);

  if (!result.success) {
    return <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Internal Link Graph</h1>
        <p className="text-caption">
          Every internal link found in published/indexable content&apos;s own body, source page to target page. Hover a node to trace its
          connections; the table below lists each link with its anchor text, how many times it appears, and the target&apos;s type and topic.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-caption">
        {(Object.keys(TYPE_LABEL) as LinkGraphContentType[]).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLOR[t] }} />
            {TYPE_LABEL[t]}
          </span>
        ))}
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border p-4 flex justify-center overflow-x-auto">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="max-w-full">
          <defs>
            <marker id="link-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const from = positionByPath.get(e.sourcePath);
            const to = positionByPath.get(e.targetPath);
            if (!from || !to) return null;
            const touchesHover = hoverPath !== null && (e.sourcePath === hoverPath || e.targetPath === hoverPath);
            const dimmed = hoverPath !== null && !touchesHover;
            const strokeWidth = 0.75 + 2.25 * (e.linkCount / maxLinkCount);
            return (
              <line
                key={i}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={TYPE_COLOR[to.node.contentType]}
                strokeWidth={strokeWidth}
                opacity={dimmed ? 0.06 : touchesHover ? 0.9 : 0.25}
                markerEnd="url(#link-arrow)"
                className="text-current"
                style={{ color: TYPE_COLOR[to.node.contentType] }}
              />
            );
          })}
          {positioned.map(({ node, x, y, angle }) => {
            const isHover = hoverPath === node.path;
            const dimmed = hoverPath !== null && !isHover;
            const labelOnRight = Math.cos(angle) >= 0;
            return (
              <g
                key={node.path}
                onMouseEnter={() => setHoverPath(node.path)}
                onMouseLeave={() => setHoverPath(null)}
                opacity={dimmed ? 0.35 : 1}
                style={{ cursor: "default" }}
              >
                <circle cx={x} cy={y} r={isHover ? 7 : 5} fill={TYPE_COLOR[node.contentType]} />
                <text
                  x={x + (labelOnRight ? 10 : -10)}
                  y={y}
                  textAnchor={labelOnRight ? "start" : "end"}
                  dominantBaseline="middle"
                  fontSize={11}
                  fill="currentColor"
                  className="text-foreground select-none"
                >
                  {node.title.length > 28 ? `${node.title.slice(0, 27)}…` : node.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as LinkGraphContentType | "ALL")}
          className="px-3 py-1.5 text-sm bg-card border border-border rounded-md text-foreground"
        >
          <option value="ALL">All target types</option>
          {(Object.keys(TYPE_LABEL) as LinkGraphContentType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by path or anchor text…"
          className="px-3 py-1.5 text-sm bg-card border border-border rounded-md text-foreground flex-1 min-w-[200px]"
        />
        <span className="text-xs text-caption whitespace-nowrap">
          {filteredEdges.length} of {edges.length} links
        </span>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Source</th>
              <th className="px-6 py-4 font-medium text-caption">Target</th>
              <th className="px-6 py-4 font-medium text-caption">Anchor</th>
              <th className="px-6 py-4 font-medium text-caption">Link Count</th>
              <th className="px-6 py-4 font-medium text-caption">Content Type</th>
              <th className="px-6 py-4 font-medium text-caption">Topic</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredEdges.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-caption">
                  No links match this filter.
                </td>
              </tr>
            ) : (
              filteredEdges.map((e, i) => {
                const sourceNode = positionByPath.get(e.sourcePath)?.node;
                const targetNode = positionByPath.get(e.targetPath)?.node;
                return (
                  <tr
                    key={i}
                    className="hover:bg-background transition-colors align-top"
                    onMouseEnter={() => setHoverPath(e.sourcePath)}
                    onMouseLeave={() => setHoverPath(null)}
                  >
                    <td className="px-6 py-4 max-w-[14rem]">
                      <div className="font-medium text-foreground">{sourceNode?.title ?? e.sourcePath}</div>
                      <div className="text-xs text-caption">{e.sourcePath}</div>
                    </td>
                    <td className="px-6 py-4 max-w-[14rem]">
                      <div className="font-medium text-foreground">{targetNode?.title ?? e.targetPath}</div>
                      <div className="text-xs text-caption">{e.targetPath}</div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <ul className="space-y-1">
                        {e.anchors.map((a, j) => (
                          <li key={j} className="text-xs">
                            <span className="italic text-foreground">&ldquo;{a.text}&rdquo;</span>
                            {a.count > 1 && <span className="text-caption"> ×{a.count}</span>}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">{e.linkCount}</td>
                    <td className="px-6 py-4">
                      {targetNode && (
                        <span
                          className="px-2 py-1 text-xs font-medium rounded-full text-white whitespace-nowrap"
                          style={{ backgroundColor: TYPE_COLOR[targetNode.contentType] }}
                        >
                          {TYPE_LABEL[targetNode.contentType]}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-caption">{targetNode?.topic || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
