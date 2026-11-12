"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "@/lib/revalidate";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { checkStale } from "@/lib/stale-check";
import { notifySearchEnginesOfUrl } from "@/lib/search-engine-ping";
import { checkDeleteDependencies, deleteAuditLabel, type DeleteOptions } from "@/lib/dependency-check";

function locationSnapshot(location: Record<string, unknown>) {
  return {
    name: location.name,
    slug: location.slug,
    market: location.market,
    addressLocality: location.addressLocality,
    isIndexable: location.isIndexable,
    metaTitle: location.metaTitle,
    metaDescription: location.metaDescription,
    order: location.order,
  };
}

// getLocations / getLocationBySlug are consumed by public location pages — stay unguarded.
// auth-check: public — public location pages
export async function getLocations() {
  try {
    return await prisma.location.findMany({ orderBy: { order: "asc" } });
  } catch (error) {
    console.error("Failed to fetch locations:", error);
    return [];
  }
}

export async function getLocation(id: string) {
  try {
    await requireSession();
    return await prisma.location.findUnique({ where: { id }, include: { faqs: { orderBy: { order: "asc" } } } });
  } catch (error) {
    console.error(`Failed to fetch location ${id}:`, error);
    return null;
  }
}

// auth-check: public — public location pages
export async function getLocationBySlug(slug: string) {
  try {
    return await prisma.location.findUnique({ where: { slug }, include: { faqs: { orderBy: { order: "asc" } } } });
  } catch (error) {
    console.error(`Failed to fetch location with slug ${slug}:`, error);
    return null;
  }
}

export async function createLocation(data: Record<string, unknown>) {
  try {
    await requirePermission("CREATE");
    const location = await prisma.location.create({ data: data as Parameters<typeof prisma.location.create>[0]["data"] });
    revalidatePath("/locations");
    revalidatePath("/locations/[slug]", "page");
    revalidatePath("/admin/locations");
    await logAudit({
      action: "create",
      category: "Content",
      entityType: "Location",
      entityId: location.id,
      entityLabel: location.name,
      after: locationSnapshot(location),
    });
    // Locations have no draft/review workflow — creating an indexable one is
    // the closest thing this content type has to a "publish" event, same
    // convention as AgencyService.
    if (location.isIndexable) {
      await notifySearchEnginesOfUrl(`/locations/${location.slug}`);
    }
    return { success: true, location };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create location:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to create location" };
  }
}

export async function updateLocation(id: string, data: Record<string, unknown>) {
  try {
    await requirePermission("EDIT");
    const before = await prisma.location.findUnique({ where: { id } });
    if (!before) {
      return { success: false, error: "Location not found" };
    }
    const { expectedUpdatedAt, ...updateData } = data;
    const staleError = checkStale(expectedUpdatedAt as string | Date | null | undefined, before.updatedAt);
    if (staleError) {
      return { success: false, error: staleError, stale: true };
    }

    const location = await prisma.location.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.location.update>[0]["data"],
    });
    revalidatePath("/locations");
    revalidatePath("/locations/[slug]", "page");
    revalidatePath("/admin/locations");
    await logAudit({
      action: "update",
      category: "Content",
      entityType: "Location",
      entityId: location.id,
      entityLabel: location.name,
      before: locationSnapshot(before),
      after: locationSnapshot(location),
    });
    if (location.isIndexable && !before.isIndexable) {
      await notifySearchEnginesOfUrl(`/locations/${location.slug}`);
    }
    return { success: true, location };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to update location ${id}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to update location" };
  }
}

// Blocked when other content depends on this item, unless options.force is
// set (the UI passes it after showing the list). See checkDeleteDependencies.
export async function deleteLocation(id: string, options?: DeleteOptions) {
  try {
    await requirePermission("DELETE");
    const { blocked, dependencies } = await checkDeleteDependencies("LOCATION", id, options);
    if (blocked) return blocked;
    const before = await prisma.location.findUnique({ where: { id } });
    await prisma.location.delete({ where: { id } });
    revalidatePath("/locations");
    revalidatePath("/admin/locations");
    await logAudit({
      action: "delete",
      category: "Content",
      entityType: "Location",
      entityId: id,
      entityLabel: deleteAuditLabel(before?.name, dependencies),
      before: before ? locationSnapshot(before) : undefined,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to delete location ${id}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete location" };
  }
}
