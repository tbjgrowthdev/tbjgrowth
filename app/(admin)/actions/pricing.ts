"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getPricingPlans() {
  try {
    return await prisma.pricingPlan.findMany({ orderBy: { order: "asc" } });
  } catch (error) {
    console.error("Failed to fetch pricing plans:", error);
    return [];
  }
}

export async function getPricingPlan(id: string) {
  try {
    return await prisma.pricingPlan.findUnique({ where: { id } });
  } catch (error) {
    console.error("Failed to fetch pricing plan:", error);
    return null;
  }
}

export async function createPricingPlan(data: any) {
  try {
    const plan = await prisma.pricingPlan.create({
      data: {
        name: data.name,
        tagline: data.tagline || null,
        priceGbp: Number(data.priceGbp) || 0,
        billingTerm: data.billingTerm || "month",
        features: JSON.stringify(
          (data.features || "")
            .split("\n")
            .map((f: string) => f.trim())
            .filter(Boolean)
        ),
        isPopular: Boolean(data.isPopular),
        order: Number(data.order) || 0,
      },
    });
    revalidatePath("/admin/pricing");
    revalidatePath("/pricing");
    return { success: true, plan };
  } catch (error: any) {
    console.error("Failed to create pricing plan:", error);
    return { success: false, error: "Failed to create pricing plan" };
  }
}

export async function updatePricingPlan(id: string, data: any) {
  try {
    const plan = await prisma.pricingPlan.update({
      where: { id },
      data: {
        name: data.name,
        tagline: data.tagline || null,
        priceGbp: Number(data.priceGbp) || 0,
        billingTerm: data.billingTerm || "month",
        features: JSON.stringify(
          (data.features || "")
            .split("\n")
            .map((f: string) => f.trim())
            .filter(Boolean)
        ),
        isPopular: Boolean(data.isPopular),
        order: Number(data.order) || 0,
      },
    });
    revalidatePath("/admin/pricing");
    revalidatePath("/pricing");
    return { success: true, plan };
  } catch (error: any) {
    console.error("Failed to update pricing plan:", error);
    return { success: false, error: "Failed to update pricing plan" };
  }
}

export async function deletePricingPlan(id: string) {
  try {
    await prisma.pricingPlan.delete({ where: { id } });
    revalidatePath("/admin/pricing");
    revalidatePath("/pricing");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete pricing plan:", error);
    return { success: false, error: error.message };
  }
}
