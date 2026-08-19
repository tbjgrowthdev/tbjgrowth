"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getPartners() {
  try {
    return await prisma.trustedPartner.findMany({
      orderBy: { order: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch partners:", error);
    return [];
  }
}

export async function getPartner(id: string) {
  try {
    return await prisma.trustedPartner.findUnique({
      where: { id },
    });
  } catch (error) {
    console.error(`Failed to fetch partner ${id}:`, error);
    return null;
  }
}

export async function createPartner(data: any) {
  try {
    const partner = await prisma.trustedPartner.create({
      data,
    });
    revalidatePath("/");
    revalidatePath("/admin/partners");
    return { success: true, partner };
  } catch (error: any) {
    console.error("Failed to create partner:", error);
    return { success: false, error: error.message };
  }
}

export async function updatePartner(id: string, data: any) {
  try {
    const partner = await prisma.trustedPartner.update({
      where: { id },
      data,
    });
    revalidatePath("/");
    revalidatePath("/admin/partners");
    return { success: true, partner };
  } catch (error: any) {
    console.error(`Failed to update partner ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function deletePartner(id: string) {
  try {
    await prisma.trustedPartner.delete({
      where: { id },
    });
    revalidatePath("/");
    revalidatePath("/admin/partners");
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to delete partner ${id}:`, error);
    return { success: false, error: error.message };
  }
}
