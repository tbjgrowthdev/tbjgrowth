"use server";

import prisma from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import {
  exportPagesJson, importPagesJson,
  exportPostsJson, importPostsJson,
  exportCaseStudiesJson, importCaseStudiesJson,
  exportServicesJson, importServicesJson,
  exportCategoriesCsv, importCategoriesCsv,
  exportTagsCsv, importTagsCsv,
  exportRedirectsCsv,
  exportMediaCsv, importMediaCsv,
  exportSeoCsv, importSeoCsv,
  type ImportResult,
} from "@/lib/import-export";

// Single gate for every function in this file. EXPORT is already a closed-
// set RBAC permission (see lib/permissions.ts) granted to SUPER_ADMIN,
// ADMIN, and SEO_MANAGER — the same roles the rest of this admin already
// trusts with bulk data access, so import (a mutation) is gated on it too
// rather than introducing a new permission the fixed role matrix doesn't have.
async function requireExport() {
  return requirePermission("EXPORT");
}

type ExportResponse = { success: true; data: string } | { success: false; error: string };

async function runExport(label: string, category: "Content" | "SEO" | "Media" | "Redirects", fn: () => Promise<string>): Promise<ExportResponse> {
  try {
    await requireExport();
    const data = await fn();
    await logAudit({ action: "export", category, entityType: label, entityLabel: `Exported ${label}` });
    return { success: true, data };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to export ${label}:`, error);
    return { success: false, error: error.message || `Failed to export ${label}` };
  }
}

type ImportResponse = ({ success: true } & ImportResult) | { success: false; error: string };

async function runImport(
  label: string,
  category: "Content" | "SEO" | "Media" | "Redirects",
  fn: (actor: { id: string; name: string | null; email: string | null }) => Promise<ImportResult>
): Promise<ImportResponse> {
  try {
    const session = await requireExport();
    const actor = { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null };
    const result = await fn(actor);
    await logAudit({
      action: "import",
      category,
      entityType: label,
      entityLabel: `${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
      after: { created: result.created, updated: result.updated, skipped: result.skipped, errorCount: result.errors.length },
    });
    return { success: true, ...result };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to import ${label}:`, error);
    return { success: false, error: error.message || `Failed to import ${label}` };
  }
}

// ---- Export ----

export async function exportPages() {
  return runExport("Page", "Content", exportPagesJson);
}
export async function exportPosts() {
  return runExport("Post", "Content", exportPostsJson);
}
export async function exportCaseStudies() {
  return runExport("CaseStudy", "Content", exportCaseStudiesJson);
}
export async function exportServices() {
  return runExport("AgencyService", "Content", exportServicesJson);
}
export async function exportCategories() {
  return runExport("Category", "Content", exportCategoriesCsv);
}
export async function exportTags() {
  return runExport("Tag", "Content", exportTagsCsv);
}
export async function exportRedirects() {
  return runExport("Redirect", "Redirects", exportRedirectsCsv);
}
export async function exportMedia() {
  return runExport("MediaAsset", "Media", exportMediaCsv);
}
export async function exportSeo() {
  return runExport("SEO metadata", "SEO", exportSeoCsv);
}

// ---- Import ----

export async function importPages(jsonText: string) {
  return runImport("Page", "Content", (actor) => importPagesJson(jsonText, actor));
}
export async function importPosts(jsonText: string) {
  return runImport("Post", "Content", (actor) => importPostsJson(jsonText, actor));
}
export async function importCaseStudies(jsonText: string) {
  return runImport("CaseStudy", "Content", (actor) => importCaseStudiesJson(jsonText, actor));
}
export async function importServices(jsonText: string) {
  return runImport("AgencyService", "Content", (actor) => importServicesJson(jsonText, actor));
}
export async function importCategories(csvText: string) {
  return runImport("Category", "Content", () => importCategoriesCsv(csvText));
}
export async function importTags(csvText: string) {
  return runImport("Tag", "Content", () => importTagsCsv(csvText));
}
export async function importMedia(csvText: string) {
  return runImport("MediaAsset", "Media", () => importMediaCsv(csvText));
}
export async function importSeo(csvText: string) {
  return runImport("SEO metadata", "SEO", (actor) => importSeoCsv(csvText, actor));
}

// Lets the page render real counts without crashing for a role that can't
// reach this page at all (nav already hides it) but could still hit the
// route directly — same convention as every other gated admin page here.
export async function getImportExportCounts() {
  try {
    await requireExport();
    const [pages, posts, caseStudies, services, categories, tags, redirects, media] = await Promise.all([
      prisma.page.count(),
      prisma.post.count(),
      prisma.caseStudy.count(),
      prisma.agencyService.count(),
      prisma.category.count(),
      prisma.tag.count(),
      prisma.redirect.count(),
      prisma.mediaAsset.count(),
    ]);
    return { pages, posts, caseStudies, services, categories, tags, redirects, media };
  } catch (error) {
    console.error("Failed to fetch import/export counts:", error);
    return { pages: 0, posts: 0, caseStudies: 0, services: 0, categories: 0, tags: 0, redirects: 0, media: 0 };
  }
}
