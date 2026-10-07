"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";

// Consumed by the public /pricing page — stays unguarded.
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
    await requireSession();
    return await prisma.pricingPlan.findUnique({ where: { id } });
  } catch (error) {
    console.error("Failed to fetch pricing plan:", error);
    return null;
  }
}

export async function createPricingPlan(data: any) {
  try {
    await requirePermission("CREATE");
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
    await logAudit({
      action: "create",
      category: "Content",
      entityType: "PricingPlan",
      entityId: plan.id,
      entityLabel: plan.name,
      after: { name: plan.name, tagline: plan.tagline, priceGbp: plan.priceGbp, billingTerm: plan.billingTerm, isPopular: plan.isPopular, order: plan.order },
    });
    return { success: true, plan };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create pricing plan:", error);
    return { success: false, error: "Failed to create pricing plan" };
  }
}

export async function updatePricingPlan(id: string, data: any) {
  try {
    await requirePermission("EDIT");
    const existing = await prisma.pricingPlan.findUnique({ where: { id } });
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
    await logAudit({
      action: "update",
      category: "Content",
      entityType: "PricingPlan",
      entityId: plan.id,
      entityLabel: plan.name,
      before: existing && { name: existing.name, tagline: existing.tagline, priceGbp: existing.priceGbp, billingTerm: existing.billingTerm, isPopular: existing.isPopular, order: existing.order },
      after: { name: plan.name, tagline: plan.tagline, priceGbp: plan.priceGbp, billingTerm: plan.billingTerm, isPopular: plan.isPopular, order: plan.order },
    });
    return { success: true, plan };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to update pricing plan:", error);
    return { success: false, error: "Failed to update pricing plan" };
  }
}

export async function deletePricingPlan(id: string) {
  try {
    await requirePermission("DELETE");
    const before = await prisma.pricingPlan.findUnique({ where: { id } });
    await prisma.pricingPlan.delete({ where: { id } });
    revalidatePath("/admin/pricing");
    revalidatePath("/pricing");
    await logAudit({
      action: "delete",
      category: "Content",
      entityType: "PricingPlan",
      entityId: id,
      entityLabel: before?.name,
      before: before && { name: before.name, tagline: before.tagline, priceGbp: before.priceGbp, billingTerm: before.billingTerm, isPopular: before.isPopular, order: before.order },
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to delete pricing plan:", error);
    return { success: false, error: error.message };
  }
}
