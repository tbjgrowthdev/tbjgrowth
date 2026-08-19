"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";

export async function getCategories() {
  try {
    return await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { posts: true } } },
    });
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return [];
  }
}

export async function createCategory(data: { name: string; description?: string }) {
  try {
    const slug = slugify(data.name);
    if (!slug) return { success: false, error: "Name cannot be empty" };

    const category = await prisma.category.create({
      data: { name: data.name, slug, description: data.description || null },
    });
    revalidatePath("/admin/categories");
    return { success: true, category };
  } catch (error: any) {
    console.error("Failed to create category:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A category with this name already exists" };
    }
    return { success: false, error: "Failed to create category" };
  }
}

export async function deleteCategory(id: string) {
  try {
    await prisma.category.delete({ where: { id } });
    revalidatePath("/admin/categories");
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to delete category ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function getTags() {
  try {
    return await prisma.tag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { posts: true } } },
    });
  } catch (error) {
    console.error("Failed to fetch tags:", error);
    return [];
  }
}

export async function createTag(data: { name: string }) {
  try {
    const slug = slugify(data.name);
    if (!slug) return { success: false, error: "Name cannot be empty" };

    const tag = await prisma.tag.create({
      data: { name: data.name, slug },
    });
    revalidatePath("/admin/tags");
    return { success: true, tag };
  } catch (error: any) {
    console.error("Failed to create tag:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A tag with this name already exists" };
    }
    return { success: false, error: "Failed to create tag" };
  }
}

export async function deleteTag(id: string) {
  try {
    await prisma.tag.delete({ where: { id } });
    revalidatePath("/admin/tags");
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to delete tag ${id}:`, error);
    return { success: false, error: error.message };
  }
}
