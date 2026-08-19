"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getSiteSettings() {
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
}

export async function updateSiteSettings(id: string, data: any) {
  try {
    const settings = await prisma.siteSetting.update({
      where: { id },
      data,
    });
    // Revalidate paths that use global settings
    revalidatePath("/", "layout");
    return { success: true, settings };
  } catch (error: any) {
    console.error("Failed to update settings:", error);
    return { success: false, error: error.message };
  }
}
