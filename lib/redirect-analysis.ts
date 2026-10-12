import prisma from "@/lib/prisma";

export type RedirectIssueType = "chain" | "loop" | "duplicate";

export type RedirectIssue = {
  type: RedirectIssueType;
  description: string;
  sources: string[]; // the redirect source paths involved, for highlighting in the UI
};

const MAX_HOPS = 20;

// Follows source -> destination -> destination's own redirect (if any) -> ...
// until it either hits something that isn't itself a redirect source (a
// normal chain end), a 410 (chain end, nothing further to follow), or a path
// already visited (a loop).
function traceChain(startSource: string, bySource: Map<string, { destination: string | null }>) {
  const path = [startSource];
  let current = startSource;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const entry = bySource.get(current);
    if (!entry || !entry.destination) {
      return { path, isLoop: false };
    }
    const next = entry.destination;
    if (path.includes(next)) {
      return { path: [...path, next], isLoop: true };
    }
    path.push(next);
    current = next;
  }
  return { path, isLoop: false };
}

export async function analyzeRedirects(): Promise<RedirectIssue[]> {
  const redirects = await prisma.redirect.findMany();
  const bySource = new Map(redirects.map((r) => [r.source, { destination: r.destination }]));

  const issues: RedirectIssue[] = [];
  const reportedLoops = new Set<string>();

  for (const r of redirects) {
    if (!r.destination) continue; // 410s don't chain anywhere
    const { path, isLoop } = traceChain(r.source, bySource);

    if (isLoop) {
      const loopKey = [...new Set(path)].sort().join("|");
      if (!reportedLoops.has(loopKey)) {
        reportedLoops.add(loopKey);
        issues.push({
          type: "loop",
          description: `Redirect loop: ${path.join(" → ")}`,
          sources: [...new Set(path)],
        });
      }
    } else if (path.length > 2) {
      // More than one hop — A redirects to B, which is itself redirected
      // elsewhere. Each step works individually; flattening A straight to
      // the final destination avoids the extra round trip.
      issues.push({
        type: "chain",
        description: `Redirect chain (${path.length - 1} hops): ${path.join(" → ")}`,
        sources: path.slice(0, -1),
      });
    }
  }

  // Duplicates: the DB's unique constraint on `source` already blocks exact
  // literal duplicates, but a trailing-slash or case variant slips past it
  // while still being functionally the same path.
  const normalizedGroups = new Map<string, string[]>();
  for (const r of redirects) {
    const key = r.source.toLowerCase().replace(/\/+$/, "") || "/";
    if (!normalizedGroups.has(key)) normalizedGroups.set(key, []);
    normalizedGroups.get(key)!.push(r.source);
  }
  for (const [key, sources] of normalizedGroups) {
    if (sources.length > 1) {
      issues.push({
        type: "duplicate",
        description: `These redirects normalize to the same path ("${key}"): ${sources.join(", ")}`,
        sources,
      });
    }
  }

  return issues;
}
