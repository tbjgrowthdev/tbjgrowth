"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getTestimonials() {
  try {
    return await prisma.testimonial.findMany({
      orderBy: { order: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch testimonials:", error);
    return [];
  }
}

export async function getTestimonial(id: string) {
  try {
    return await prisma.testimonial.findUnique({
      where: { id },
    });
  } catch (error) {
    console.error(`Failed to fetch testimonial ${id}:`, error);
    return null;
  }
}

export async function createTestimonial(data: any) {
  try {
    const testimonial = await prisma.testimonial.create({
      data,
    });
    revalidatePath("/");
    revalidatePath("/about");
    revalidatePath("/admin/testimonials");
    return { success: true, testimonial };
  } catch (error: any) {
    console.error("Failed to create testimonial:", error);
    return { success: false, error: error.message };
  }
}

export async function updateTestimonial(id: string, data: any) {
  try {
    const testimonial = await prisma.testimonial.update({
      where: { id },
      data,
    });
    revalidatePath("/");
    revalidatePath("/about");
    revalidatePath("/admin/testimonials");
    return { success: true, testimonial };
  } catch (error: any) {
    console.error(`Failed to update testimonial ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function deleteTestimonial(id: string) {
  try {
    await prisma.testimonial.delete({
      where: { id },
    });
    revalidatePath("/");
    revalidatePath("/about");
    revalidatePath("/admin/testimonials");
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to delete testimonial ${id}:`, error);
    return { success: false, error: error.message };
  }
}
