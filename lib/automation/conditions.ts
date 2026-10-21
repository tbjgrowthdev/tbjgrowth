import type { ContentType } from "@/lib/generated/prisma/client";
import type { AutomationEventPayload, RuleConditions } from "./types";

/**
 * Deliberately not a general rule engine — just the two filters the spec's
 * own examples actually need (content type, and severity for the signal
 * events). An empty/absent allow-list on either field means "no filter,"
 * never "match nothing."
 */
export function matchesConditions(conditions: RuleConditions | null, payload: AutomationEventPayload): boolean {
  if (!conditions) return true;

  if (conditions.contentTypes?.length) {
    if (!conditions.contentTypes.includes(payload.contentType as ContentType)) return false;
  }

  if (conditions.severities?.length) {
    if (!payload.data.severity || !conditions.severities.includes(payload.data.severity)) return false;
  }

  return true;
}

export function parseConditions(raw: string | null): RuleConditions | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RuleConditions;
  } catch {
    return null;
  }
}
