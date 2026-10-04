"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getFaqs() {
  try {
    return await prisma.faq.findMany({
      orderBy: { order: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch FAQs:", error);
    return [];
  }
}

export async function getFaq(id: string) {
  try {
    return await prisma.faq.findUnique({
      where: { id },
    });
  } catch (error) {
    console.error(`Failed to fetch FAQ ${id}:`, error);
    return null;
  }
}

export async function createFaq(data: any) {
  try {
    const faq = await prisma.faq.create({
      data,
    });
    revalidatePath("/");
    revalidatePath("/admin/faqs");
    return { success: true, faq };
  } catch (error: any) {
    console.error("Failed to create FAQ:", error);
    return { success: false, error: error.message };
  }
}

export async function updateFaq(id: string, data: any) {
  try {
    const faq = await prisma.faq.update({
      where: { id },
      data,
    });
    revalidatePath("/");
    revalidatePath("/admin/faqs");
    return { success: true, faq };
  } catch (error: any) {
    console.error(`Failed to update FAQ ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function deleteFaq(id: string) {
  try {
    await prisma.faq.delete({
      where: { id },
    });
    revalidatePath("/");
    revalidatePath("/admin/faqs");
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to delete FAQ ${id}:`, error);
    return { success: false, error: error.message };
  }
}
