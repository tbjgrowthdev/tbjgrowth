"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getGoogleIntegration as getGoogleIntegrationInternal } from "@/lib/google-oauth";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";

// Re-exported from a "use server" module, this would otherwise be directly
// callable by the client with no guard at all — wrap it instead of
// re-exporting the lib function raw.
export async function getGoogleIntegration() {
  await requireSession();
  return getGoogleIntegrationInternal();
}

export async function disconnectGoogle() {
  try {
    await requirePermission("INTEGRATION_MANAGEMENT");
    const integration = await prisma.googleIntegration.findFirst();
    if (integration) {
      await prisma.googleIntegration.delete({ where: { id: integration.id } });
      await logAudit({
        action: "delete",
        category: "Integrations",
        entityType: "GoogleIntegration",
        entityId: integration.id,
        entityLabel: integration.connectedEmail || integration.id,
        before: {
          connectedEmail: integration.connectedEmail,
          ga4PropertyId: integration.ga4PropertyId,
          gscSiteUrl: integration.gscSiteUrl,
          scope: integration.scope,
        },
      });
    }
    revalidatePath("/admin/seo");
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to disconnect Google integration:", error);
    return { success: false, error: "Failed to disconnect" };
  }
}

export async function updateGoogleConfig(data: { ga4PropertyId?: string; gscSiteUrl?: string }) {
  try {
    await requirePermission("INTEGRATION_MANAGEMENT");
    const integration = await prisma.googleIntegration.findFirst();
    if (!integration) {
      return { success: false, error: "Connect Google first" };
    }
    await prisma.googleIntegration.update({
      where: { id: integration.id },
      data: {
        ga4PropertyId: data.ga4PropertyId?.trim() || null,
        gscSiteUrl: data.gscSiteUrl?.trim() || null,
      },
    });
    revalidatePath("/admin/seo");
    await logAudit({
      action: "update",
      category: "Integrations",
      entityType: "GoogleIntegration",
      entityId: integration.id,
      entityLabel: integration.connectedEmail || integration.id,
      before: { ga4PropertyId: integration.ga4PropertyId, gscSiteUrl: integration.gscSiteUrl },
      after: { ga4PropertyId: data.ga4PropertyId?.trim() || null, gscSiteUrl: data.gscSiteUrl?.trim() || null },
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to update Google config:", error);
    return { success: false, error: "Failed to save configuration" };
  }
}
