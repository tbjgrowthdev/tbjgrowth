"use client";

import { useMemo, useState } from "react";
import type { getTopicClustersAction } from "@/app/(admin)/actions/topic-clusters";
import type { ClusterContentType, TopicClusterMember } from "@/lib/topic-clusters/types";

type Result = Awaited<ReturnType<typeof getTopicClustersAction>>;

const TYPE_LABEL: Record<ClusterContentType, string> = {
  POST: "Blog Post",
  PAGE: "Page",
  CASE_STUDY: "Case Study",
  SERVICE: "Service",
};

const ROLE_COLOR = {
  PILLAR: "#f97316",
  CLUSTER: "#3b82f6",
  SUPPORTING: "#9ca3af",
} as const;

const ROLE_LABEL = {
  PILLAR: "Pillar content",
  CLUSTER: "Cluster content",
  SUPPORTING: "Supporting content",
} as const;

const SIZE = 560;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 90;

function spokePositions(members: TopicClusterMember[]) {
  return members.map((member, i) => {
    const angle = (2 * Math.PI * i) / Math.max(members.length, 1) - Math.PI / 2;
    return { member, x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle), angle };
  });
}

export default function TopicClustersClient({ result }: { result: Result }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const clusters = result.success ? result.data : [];
  const activeCluster = clusters.find((c) => c.id === selectedId) ?? clusters[0] ?? null;
  const spokes = useMemo(() => (activeCluster ? spokePositions(activeCluster.members) : []), [activeCluster]);

  if (!result.success) {
    return <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Topic Clusters</h1>
        <p className="text-caption">
          Published/indexable content grouped by shared topic (word-overlap similarity), each with a pillar — its most substantial page —
          and the rest classified as cluster content (already links to the pillar) or supporting content (same topic, but not linked up to
          the pillar yet).
        </p>
      </div>

      {clusters.length === 0 ? (
        <p className="text-sm text-caption">No topic clusters found — content needs at least two published/indexable pages sharing enough topic overlap.</p>
      ) : (
        <div className="flex flex-wrap gap-6">
          <div className="w-full lg:w-64 flex-shrink-0 bg-card rounded-lg shadow-sm border border-border overflow-hidden">
            <ul className="divide-y divide-border max-h-[560px] overflow-y-auto">
              {clusters.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-background transition-colors ${
                      activeCluster?.id === c.id ? "bg-background text-foreground font-medium" : "text-caption"
                    }`}
                  >
                    <div className="truncate">{c.topic}</div>
                    <div className="text-xs text-caption">
                      {c.members.filter((m) => m.role === "CLUSTER").length} cluster · {c.members.filter((m) => m.role === "SUPPORTING").length}{" "}
                      supporting
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {activeCluster && (
            <div className="flex-1 min-w-[320px] space-y-6">
              <div className="flex flex-wrap items-center gap-4 text-xs text-caption">
                {(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).map((r) => (
                  <span key={r} className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ROLE_COLOR[r] }} />
                    {ROLE_LABEL[r]}
                  </span>
                ))}
              </div>

              <div className="bg-card rounded-lg shadow-sm border border-border p-4 flex justify-center overflow-x-auto">
                <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="max-w-full">
                  <defs>
                    <marker id="cluster-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                      <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
                    </marker>
                  </defs>
                  {spokes.map(({ member, x, y }) => (
                    <line
                      key={`edge-${member.path}`}
                      x1={CENTER}
                      y1={CENTER}
                      x2={x}
                      y2={y}
                      stroke={member.linksToPillar ? ROLE_COLOR.CLUSTER : ROLE_COLOR.SUPPORTING}
                      strokeWidth={1.5}
                      strokeDasharray={member.linksToPillar ? undefined : "4 4"}
                      opacity={member.linksToPillar ? 0.7 : 0.5}
                      markerEnd="url(#cluster-arrow)"
                      style={{ color: member.linksToPillar ? ROLE_COLOR.CLUSTER : ROLE_COLOR.SUPPORTING }}
                    />
                  ))}
                  <g>
                    <circle cx={CENTER} cy={CENTER} r={11} fill={ROLE_COLOR.PILLAR} />
                    <text x={CENTER} y={CENTER + 22} textAnchor="middle" fontSize={12} fontWeight={600} fill="currentColor" className="text-foreground select-none">
                      {activeCluster.pillar.title.length > 32 ? `${activeCluster.pillar.title.slice(0, 31)}…` : activeCluster.pillar.title}
                    </text>
                    <title>{activeCluster.pillar.title}</title>
                  </g>
                  {spokes.map(({ member, x, y, angle }) => {
                    const labelOnRight = Math.cos(angle) >= 0;
                    return (
                      <g key={member.path}>
                        <circle cx={x} cy={y} r={6} fill={ROLE_COLOR[member.role]} />
                        <title>{member.title}</title>
                        <text
                          x={x + (labelOnRight ? 9 : -9)}
                          y={y}
                          textAnchor={labelOnRight ? "start" : "end"}
                          dominantBaseline="middle"
                          fontSize={11}
                          fill="currentColor"
                          className="text-foreground select-none"
                        >
                          {member.title.length > 26 ? `${member.title.slice(0, 25)}…` : member.title}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-background border-b border-border">
                      <th className="px-6 py-4 font-medium text-caption">Page</th>
                      <th className="px-6 py-4 font-medium text-caption">Role</th>
                      <th className="px-6 py-4 font-medium text-caption">Content Type</th>
                      <th className="px-6 py-4 font-medium text-caption">Topic</th>
                      <th className="px-6 py-4 font-medium text-caption">Links to Pillar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="bg-background/50">
                      <td className="px-6 py-4 font-medium text-foreground">
                        {activeCluster.pillar.title}
                        <div className="text-xs text-caption">{activeCluster.pillar.path}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs font-medium rounded-full text-white whitespace-nowrap" style={{ backgroundColor: ROLE_COLOR.PILLAR }}>
                          {ROLE_LABEL.PILLAR}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-caption">{TYPE_LABEL[activeCluster.pillar.contentType]}</td>
                      <td className="px-6 py-4 text-sm text-caption">{activeCluster.pillar.topic || "—"}</td>
                      <td className="px-6 py-4 text-sm text-caption">—</td>
                    </tr>
                    {activeCluster.members.map((m) => (
                      <tr key={m.path} className="hover:bg-background transition-colors">
                        <td className="px-6 py-4 font-medium text-foreground max-w-[14rem]">
                          {m.title}
                          <div className="text-xs text-caption">{m.path}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs font-medium rounded-full text-white whitespace-nowrap" style={{ backgroundColor: ROLE_COLOR[m.role] }}>
                            {ROLE_LABEL[m.role]}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-caption">{TYPE_LABEL[m.contentType]}</td>
                        <td className="px-6 py-4 text-sm text-caption">{m.topic || "—"}</td>
                        <td className="px-6 py-4 text-sm">
                          {m.linksToPillar ? (
                            <span className="text-green-600 dark:text-green-400">Yes</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">Not yet</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
