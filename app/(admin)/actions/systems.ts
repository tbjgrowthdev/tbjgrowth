"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getSystems() {
  try {
    return await prisma.tBJSystem.findMany({
      orderBy: { order: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch systems:", error);
    return [];
  }
}

export async function getSystem(id: string) {
  try {
    return await prisma.tBJSystem.findUnique({
      where: { id },
    });
  } catch (error) {
    console.error(`Failed to fetch system ${id}:`, error);
    return null;
  }
}

export async function createSystem(data: any) {
  try {
    const system = await prisma.tBJSystem.create({
      data,
    });
    revalidatePath("/");
    revalidatePath("/admin/systems");
    return { success: true, system };
  } catch (error: any) {
    console.error("Failed to create system:", error);
    return { success: false, error: error.message };
  }
}

export async function updateSystem(id: string, data: any) {
  try {
    const system = await prisma.tBJSystem.update({
      where: { id },
      data,
    });
    revalidatePath("/");
    revalidatePath("/admin/systems");
    return { success: true, system };
  } catch (error: any) {
    console.error(`Failed to update system ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function deleteSystem(id: string) {
  try {
    await prisma.tBJSystem.delete({
      where: { id },
    });
    revalidatePath("/");
    revalidatePath("/admin/systems");
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to delete system ${id}:`, error);
    return { success: false, error: error.message };
  }
}
