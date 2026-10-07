"use server";

import { cache } from "react";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";

// Memoized per-request: the root layout, every detail page's generateMetadata,
// and the page component itself all call this for the same incoming request —
// cache() collapses those into a single DB query instead of one each.
export const getSiteSettings = cache(async function getSiteSettings() {
  try {
    let settings = await prisma.siteSetting.findFirst();
    if (!settings) {
      settings = await prisma.siteSetting.create({
        data: {
          phone: "",
          email: "",
          address: "",
        },
      });
    }
    return settings;
  } catch (error) {
    console.error("Failed to fetch site settings:", error);
    return null;
  }
});

export async function updateSiteSettings(id: string, data: any) {
  try {
    await requirePermission("SETTINGS_MANAGEMENT");
    const before = await prisma.siteSetting.findUnique({ where: { id } });
    const settings = await prisma.siteSetting.update({
      where: { id },
      data,
    });
    // Revalidate paths that use global settings
    revalidatePath("/", "layout");
    await logAudit({
      action: "update",
      category: "Settings",
      entityType: "SiteSetting",
      entityId: id,
      entityLabel: settings.email || settings.phone || id,
      before: before ?? undefined,
      after: settings,
    });
    return { success: true, settings };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to update settings:", error);
    return { success: false, error: error.message };
  }
}
