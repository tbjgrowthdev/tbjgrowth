"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getGoogleIntegration } from "@/lib/google-oauth";

export { getGoogleIntegration };

export async function disconnectGoogle() {
  try {
    const integration = await prisma.googleIntegration.findFirst();
    if (integration) {
      await prisma.googleIntegration.delete({ where: { id: integration.id } });
    }
    revalidatePath("/admin/seo");
    return { success: true };
  } catch (error) {
    console.error("Failed to disconnect Google integration:", error);
    return { success: false, error: "Failed to disconnect" };
  }
}

export async function updateGoogleConfig(data: { ga4PropertyId?: string; gscSiteUrl?: string }) {
  try {
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
    return { success: true };
  } catch (error) {
    console.error("Failed to update Google config:", error);
    return { success: false, error: "Failed to save configuration" };
  }
}
