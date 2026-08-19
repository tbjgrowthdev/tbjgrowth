"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getServices() {
  try {
    return await prisma.agencyService.findMany({
      orderBy: { order: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch services:", error);
    return [];
  }
}

export async function getService(id: string) {
  try {
    return await prisma.agencyService.findUnique({
      where: { id },
    });
  } catch (error) {
    console.error(`Failed to fetch service ${id}:`, error);
    return null;
  }
}

export async function createService(data: any) {
  try {
    const service = await prisma.agencyService.create({
      data,
    });
    revalidatePath("/");
    revalidatePath("/services");
    revalidatePath("/admin/services");
    return { success: true, service };
  } catch (error: any) {
    console.error("Failed to create service:", error);
    return { success: false, error: error.message };
  }
}

export async function updateService(id: string, data: any) {
  try {
    const service = await prisma.agencyService.update({
      where: { id },
      data,
    });
    revalidatePath("/");
    revalidatePath("/services");
    revalidatePath("/admin/services");
    return { success: true, service };
  } catch (error: any) {
    console.error(`Failed to update service ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function deleteService(id: string) {
  try {
    await prisma.agencyService.delete({
      where: { id },
    });
    revalidatePath("/");
    revalidatePath("/services");
    revalidatePath("/admin/services");
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to delete service ${id}:`, error);
    return { success: false, error: error.message };
  }
}
