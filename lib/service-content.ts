/**
 * Shared parsing for AgencyService's JSON text fields (features, process,
 * deliverables). Used by every page that displays a service — homepage grid,
 * the /services overview, and /services/[slug] — so all three always agree
 * on what a stored value means instead of each re-implementing its own
 * (previously inconsistent) parsing.
 */

export type ServiceFeature = { icon?: string; text: string };
export type ServiceProcessStep = { step: number; title: string; desc: string };

function parseJsonArray(raw: unknown): unknown[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Accepts plain strings (current shape) or legacy { icon, text } objects.
export function parseFeatures(raw: unknown): ServiceFeature[] {
  return parseJsonArray(raw)
    .map((item): ServiceFeature => {
      if (typeof item === "string") return { text: item };
      const obj = item as { icon?: string; text?: string } | null;
      return { icon: obj?.icon, text: obj?.text || "" };
    })
    .filter((f) => f.text);
}

export function parseProcess(raw: unknown): ServiceProcessStep[] {
  return parseJsonArray(raw).map((item, i) => {
    const obj = item as { step?: number; title?: string; desc?: string } | null;
    return { step: obj?.step ?? i + 1, title: obj?.title || "", desc: obj?.desc || "" };
  });
}

export function parseDeliverables(raw: unknown): string[] {
  return parseJsonArray(raw)
    .map((item) => (typeof item === "string" ? item : (item as { text?: string } | null)?.text || ""))
    .filter(Boolean);
}
