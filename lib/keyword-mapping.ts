/**
 * Keyword → URL mapping conflict detection.
 *
 * Each keyword term already supports multiple target-URL rows (the schema's
 * @@unique is on [term, targetUrl], not on term alone), so the same term can
 * legitimately point at more than one URL — e.g. an informational guide and
 * a separate commercial landing page for the same phrase. That's fine. What
 * is NOT fine is two (or more) different URLs targeting the same term AND
 * the same search intent: nothing distinguishes which page should actually
 * rank, so Google is left to pick, and the mapping is ambiguous. This is a
 * deterministic, AI-free check — no fuzzy keyword-similarity matching — on
 * exactly the data the admin already entered.
 */

export interface KeywordForConflictCheck {
  id: string;
  term: string;
  targetUrl: string | null;
  searchIntent: string;
  status: string;
}

export interface IntentConflict {
  term: string;
  searchIntent: string;
  targetUrls: string[];
  keywordIds: string[];
}

/**
 * Archived keywords are excluded — they're no longer being actively pursued,
 * so a stale mapping left over from retired targeting shouldn't raise a
 * warning about keywords that are still live.
 */
export function findKeywordIntentConflicts<T extends KeywordForConflictCheck>(keywords: T[]): IntentConflict[] {
  const groups = new Map<string, { term: string; searchIntent: string; urls: Map<string, string[]> }>();

  for (const kw of keywords) {
    if (kw.status === "ARCHIVED" || !kw.targetUrl) continue;
    const key = `${kw.term.trim().toLowerCase()}::${kw.searchIntent}`;
    let group = groups.get(key);
    if (!group) {
      group = { term: kw.term.trim(), searchIntent: kw.searchIntent, urls: new Map() };
      groups.set(key, group);
    }
    const ids = group.urls.get(kw.targetUrl) || [];
    ids.push(kw.id);
    group.urls.set(kw.targetUrl, ids);
  }

  const conflicts: IntentConflict[] = [];
  for (const group of groups.values()) {
    if (group.urls.size > 1) {
      conflicts.push({
        term: group.term,
        searchIntent: group.searchIntent,
        targetUrls: Array.from(group.urls.keys()),
        keywordIds: Array.from(group.urls.values()).flat(),
      });
    }
  }
  return conflicts.sort((a, b) => a.term.localeCompare(b.term));
}
