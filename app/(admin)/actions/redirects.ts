"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { invalidateRedirectCache } from "@/lib/redirect-cache";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { analyzeRedirects } from "@/lib/redirect-analysis";

const VALID_STATUS_CODES = [301, 302, 307, 410];

export async function getRedirects() {
  try {
    await requirePermission("SEO_MANAGEMENT");
    return await prisma.redirect.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch redirects:", error);
    return [];
  }
}

export async function getRedirectDiagnostics() {
  try {
    await requirePermission("SEO_MANAGEMENT");
    return await analyzeRedirects();
  } catch (error) {
    console.error("Failed to analyze redirects:", error);
    return [];
  }
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function validateStatusCode(statusCode: number): string | null {
  if (!VALID_STATUS_CODES.includes(statusCode)) {
    return "Status code must be 301, 302, 307, or 410";
  }
  return null;
}

export async function createRedirect(data: { source: string; destination?: string; statusCode: number }) {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const source = normalizePath(data.source);
    const statusError = validateStatusCode(data.statusCode);
    if (statusError) {
      return { success: false, error: statusError };
    }

    if (!source) {
      return { success: false, error: "Source is required" };
    }

    const isGone = data.statusCode === 410;
    const destination = isGone ? null : normalizePath(data.destination || "");

    if (!isGone && !destination) {
      return { success: false, error: "Destination is required unless the status is 410 (Gone)" };
    }
    if (destination && source === destination) {
      return { success: false, error: "Source and destination cannot be the same" };
    }

    const redirect = await prisma.redirect.create({
      data: { source, destination, statusCode: data.statusCode },
    });
    invalidateRedirectCache();
    revalidatePath("/admin/redirects");
    await logAudit({
      action: "create",
      category: "Redirects",
      entityType: "Redirect",
      entityId: redirect.id,
      entityLabel: `${redirect.source} → ${redirect.destination ?? "(410 Gone)"}`,
      after: { source: redirect.source, destination: redirect.destination, statusCode: redirect.statusCode },
    });
    return { success: true, redirect };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create redirect:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A redirect from this source path already exists" };
    }
    return { success: false, error: "Failed to create redirect" };
  }
}

export async function updateRedirect(id: string, data: { source: string; destination?: string; statusCode: number }) {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const before = await prisma.redirect.findUnique({ where: { id } });
    if (!before) {
      return { success: false, error: "Redirect not found" };
    }

    const source = normalizePath(data.source);
    const statusError = validateStatusCode(data.statusCode);
    if (statusError) {
      return { success: false, error: statusError };
    }
    if (!source) {
      return { success: false, error: "Source is required" };
    }

    const isGone = data.statusCode === 410;
    const destination = isGone ? null : normalizePath(data.destination || "");

    if (!isGone && !destination) {
      return { success: false, error: "Destination is required unless the status is 410 (Gone)" };
    }
    if (destination && source === destination) {
      return { success: false, error: "Source and destination cannot be the same" };
    }

    const redirect = await prisma.redirect.update({
      where: { id },
      data: { source, destination, statusCode: data.statusCode },
    });
    invalidateRedirectCache();
    revalidatePath("/admin/redirects");
    await logAudit({
      action: "update",
      category: "Redirects",
      entityType: "Redirect",
      entityId: id,
      entityLabel: `${redirect.source} → ${redirect.destination ?? "(410 Gone)"}`,
      before: { source: before.source, destination: before.destination, statusCode: before.statusCode },
      after: { source: redirect.source, destination: redirect.destination, statusCode: redirect.statusCode },
    });
    return { success: true, redirect };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to update redirect ${id}:`, error);
    if (error.code === "P2002") {
      return { success: false, error: "A redirect from this source path already exists" };
    }
    return { success: false, error: "Failed to update redirect" };
  }
}

export async function deleteRedirect(id: string) {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const before = await prisma.redirect.findUnique({ where: { id } });
    await prisma.redirect.delete({ where: { id } });
    invalidateRedirectCache();
    revalidatePath("/admin/redirects");
    if (before) {
      await logAudit({
        action: "delete",
        category: "Redirects",
        entityType: "Redirect",
        entityId: id,
        entityLabel: `${before.source} → ${before.destination ?? "(410 Gone)"}`,
        before: { source: before.source, destination: before.destination, statusCode: before.statusCode },
      });
    }
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to delete redirect ${id}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Bulk import redirects from CSV text: "source,destination,statusCode" per
 * line. statusCode is optional and defaults to 301; destination may be left
 * blank only when statusCode is 410. Skips blank lines and a header row.
 */
export async function bulkImportRedirects(csvText: string) {
  try {
    await requirePermission("SEO_MANAGEMENT");
  } catch (error: any) {
    return { success: false, created: 0, skipped: 0, errors: [error.message] };
  }

  const lines = csvText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const line of lines) {
    const [rawSource, rawDestination, rawStatusCode] = line.split(",").map((p) => p?.trim());

    if (!rawSource) {
      skipped++;
      continue;
    }
    if (rawSource.toLowerCase() === "source") {
      // header row
      continue;
    }

    const source = normalizePath(rawSource);
    const statusCode = rawStatusCode ? parseInt(rawStatusCode, 10) : 301;

    if (!VALID_STATUS_CODES.includes(statusCode)) {
      errors.push(`${source}: invalid status code "${rawStatusCode}"`);
      continue;
    }

    const isGone = statusCode === 410;
    const destination = isGone ? null : normalizePath(rawDestination || "");

    if (!isGone && !destination) {
      skipped++;
      continue;
    }
    if (destination && source === destination) {
      skipped++;
      continue;
    }

    try {
      await prisma.redirect.create({ data: { source, destination, statusCode } });
      created++;
    } catch (error: any) {
      if (error.code === "P2002") {
        skipped++;
      } else {
        errors.push(`${source}: ${error.message}`);
      }
    }
  }

  invalidateRedirectCache();
  revalidatePath("/admin/redirects");
  await logAudit({
    action: "bulkImport",
    category: "Redirects",
    entityType: "Redirect",
    entityLabel: `${created} created, ${skipped} skipped`,
    after: { created, skipped, errorCount: errors.length },
  });
  return { success: true, created, skipped, errors };
}
