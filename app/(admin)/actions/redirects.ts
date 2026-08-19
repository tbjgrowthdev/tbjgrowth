"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { invalidateRedirectCache } from "@/lib/redirect-cache";

export async function getRedirects() {
  try {
    return await prisma.redirect.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch redirects:", error);
    return [];
  }
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export async function createRedirect(data: { source: string; destination: string; permanent?: boolean }) {
  try {
    const source = normalizePath(data.source);
    const destination = normalizePath(data.destination);

    if (!source || !destination) {
      return { success: false, error: "Source and destination are required" };
    }
    if (source === destination) {
      return { success: false, error: "Source and destination cannot be the same" };
    }

    const redirect = await prisma.redirect.create({
      data: { source, destination, permanent: data.permanent ?? true },
    });
    invalidateRedirectCache();
    revalidatePath("/admin/redirects");
    return { success: true, redirect };
  } catch (error: any) {
    console.error("Failed to create redirect:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A redirect from this source path already exists" };
    }
    return { success: false, error: "Failed to create redirect" };
  }
}

export async function deleteRedirect(id: string) {
  try {
    await prisma.redirect.delete({ where: { id } });
    invalidateRedirectCache();
    revalidatePath("/admin/redirects");
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to delete redirect ${id}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Bulk import redirects from CSV text: "source,destination,permanent" per line
 * (permanent is optional, defaults to true). Skips blank lines and a header row.
 */
export async function bulkImportRedirects(csvText: string) {
  const lines = csvText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const line of lines) {
    const [rawSource, rawDestination, rawPermanent] = line.split(",").map((p) => p?.trim());

    if (!rawSource || !rawDestination) {
      skipped++;
      continue;
    }
    if (rawSource.toLowerCase() === "source") {
      // header row
      continue;
    }

    const source = normalizePath(rawSource);
    const destination = normalizePath(rawDestination);
    const permanent = rawPermanent ? rawPermanent.toLowerCase() !== "302" && rawPermanent.toLowerCase() !== "false" : true;

    if (source === destination) {
      skipped++;
      continue;
    }

    try {
      await prisma.redirect.create({ data: { source, destination, permanent } });
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
  return { success: true, created, skipped, errors };
}
