import prisma from "@/lib/prisma";
import type { ExperimentContentType } from "@/lib/seo-experiments/types";
import { SEO_CHANGE_FIELDS, SEO_FIELD_LABELS, type SeoChangeEntry, type SeoChangeField } from "./types";

// AuditLog.entityType as written by each content type's update action.
const ENTITY_TYPE_MAP: Record<string, ExperimentContentType> = {
  Post: "POST",
  Page: "PAGE",
  CaseStudy: "CASE_STUDY",
  AgencyService: "SERVICE",
};

const PATH_BUILDERS: Record<ExperimentContentType, (slug: string) => string> = {
  POST: (slug) => `/blog/${slug}`,
  PAGE: (slug) => `/${slug}`,
  CASE_STUDY: (slug) => `/case-studies/${slug}`,
  SERVICE: (slug) => `/services/${slug}`,
};

// How many raw AuditLog rows to scan — generous because one row can yield
// zero-to-many change entries (one per changed SEO field), so scanning has
// to happen before the final, smaller page is sliced off.
const RAW_ROW_SCAN_LIMIT = 500;

function stringifyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export interface SeoChangeLogFilters {
  contentType?: ExperimentContentType;
  contentId?: string;
  field?: SeoChangeField;
  limit?: number;
}

/**
 * Flattens the general AuditLog into a feed of individual SEO field
 * changes — one entry per (audit row, changed SEO field) pair. There's no
 * dedicated write path for this: every content update action already
 * snapshots its SEO fields into AuditLog.before/after (see postSnapshot
 * etc.), so this is purely a read-time diff over that existing trail.
 */
export async function getSeoChangeLog(filters: SeoChangeLogFilters = {}): Promise<SeoChangeEntry[]> {
  const entityTypes = Object.keys(ENTITY_TYPE_MAP).filter(
    (et) => !filters.contentType || ENTITY_TYPE_MAP[et] === filters.contentType
  );

  const rows = await prisma.auditLog.findMany({
    where: {
      entityType: { in: entityTypes },
      action: "update",
      before: { not: null },
      after: { not: null },
      ...(filters.contentId ? { entityId: filters.contentId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: RAW_ROW_SCAN_LIMIT,
  });

  const entries: SeoChangeEntry[] = [];
  for (const row of rows) {
    if (!row.before || !row.after || !row.entityId) continue;
    const contentType = ENTITY_TYPE_MAP[row.entityType];
    if (!contentType) continue;

    let before: Record<string, unknown>;
    let after: Record<string, unknown>;
    try {
      before = JSON.parse(row.before) as Record<string, unknown>;
      after = JSON.parse(row.after) as Record<string, unknown>;
    } catch {
      continue;
    }

    const slug = (after.slug ?? before.slug) as string | null | undefined;
    const contentPath = slug ? PATH_BUILDERS[contentType](slug) : null;

    for (const field of SEO_CHANGE_FIELDS) {
      if (!(field in after) && !(field in before)) continue;
      if (valuesEqual(before[field], after[field])) continue;

      entries.push({
        id: `${row.id}:${field}`,
        auditLogId: row.id,
        contentType,
        contentId: row.entityId,
        contentTitle: row.entityLabel,
        contentPath,
        field,
        fieldLabel: SEO_FIELD_LABELS[field],
        oldValue: stringifyValue(before[field]),
        newValue: stringifyValue(after[field]),
        changedAt: row.createdAt,
        changedBy: row.userName || row.userEmail,
      });
    }
  }

  const filtered = filters.field ? entries.filter((e) => e.field === filters.field) : entries;
  return filtered.slice(0, filters.limit ?? 100);
}
