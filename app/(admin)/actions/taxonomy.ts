"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";

export async function getCategories() {
  try {
    await requireSession();
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
    await requirePermission("CREATE");
    const slug = slugify(data.name);
    if (!slug) return { success: false, error: "Name cannot be empty" };

    const category = await prisma.category.create({
      data: { name: data.name, slug, description: data.description || null },
    });
    revalidatePath("/admin/categories");
    await logAudit({
      action: "create",
      category: "Content",
      entityType: "Category",
      entityId: category.id,
      entityLabel: category.name,
      after: { name: category.name, slug: category.slug, description: category.description },
    });
    return { success: true, category };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create category:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A category with this name already exists" };
    }
    return { success: false, error: "Failed to create category" };
  }
}

export async function deleteCategory(id: string) {
  try {
    await requirePermission("DELETE");
    const before = await prisma.category.findUnique({ where: { id } });
    await prisma.category.delete({ where: { id } });
    revalidatePath("/admin/categories");
    await logAudit({
      action: "delete",
      category: "Content",
      entityType: "Category",
      entityId: id,
      entityLabel: before?.name,
      before: before && { name: before.name, slug: before.slug, description: before.description },
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to delete category ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function getTags() {
  try {
    await requireSession();
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
    await requirePermission("CREATE");
    const slug = slugify(data.name);
    if (!slug) return { success: false, error: "Name cannot be empty" };

    const tag = await prisma.tag.create({
      data: { name: data.name, slug },
    });
    revalidatePath("/admin/tags");
    await logAudit({
      action: "create",
      category: "Content",
      entityType: "Tag",
      entityId: tag.id,
      entityLabel: tag.name,
      after: { name: tag.name, slug: tag.slug },
    });
    return { success: true, tag };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create tag:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A tag with this name already exists" };
    }
    return { success: false, error: "Failed to create tag" };
  }
}

export async function deleteTag(id: string) {
  try {
    await requirePermission("DELETE");
    const before = await prisma.tag.findUnique({ where: { id } });
    await prisma.tag.delete({ where: { id } });
    revalidatePath("/admin/tags");
    await logAudit({
      action: "delete",
      category: "Content",
      entityType: "Tag",
      entityId: id,
      entityLabel: before?.name,
      before: before && { name: before.name, slug: before.slug },
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to delete tag ${id}:`, error);
    return { success: false, error: error.message };
  }
}
