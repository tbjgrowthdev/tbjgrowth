"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { uploadAndRegisterMedia, uploadToCloudinary, destroyImage } from "@/lib/cloudinary";

type SortBy = "createdAt" | "title" | "bytes";
type SortOrder = "asc" | "desc";

// Gated the same as every mutation here, not just requireSession() — this
// read surface has exactly one consumer (the Library page + its picker),
// both already restricted to roles that can act on what they see. No reason
// for a role without MEDIA_MANAGEMENT to list raw asset metadata
// (publicId, bytes, uploader email) it has no permission to touch.
export async function getMediaAssets(filters?: { search?: string; folder?: string; sortBy?: SortBy; sortOrder?: SortOrder }) {
  try {
    await requirePermission("MEDIA_MANAGEMENT");
    const search = filters?.search?.trim();
    return await prisma.mediaAsset.findMany({
      where: {
        folder: filters?.folder || undefined,
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { filename: { contains: search, mode: "insensitive" } },
                { altText: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { [filters?.sortBy || "createdAt"]: filters?.sortOrder || "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch media assets:", error);
    return [];
  }
}

export async function getMediaAsset(id: string) {
  try {
    await requirePermission("MEDIA_MANAGEMENT");
    return await prisma.mediaAsset.findUnique({ where: { id } });
  } catch (error) {
    console.error("Failed to fetch media asset:", error);
    return null;
  }
}

export async function getMediaFolders() {
  try {
    await requirePermission("MEDIA_MANAGEMENT");
    const rows = await prisma.mediaAsset.findMany({
      distinct: ["folder"],
      select: { folder: true },
      orderBy: { folder: "asc" },
    });
    return rows.map((r) => r.folder);
  } catch (error) {
    console.error("Failed to fetch media folders:", error);
    return [];
  }
}

// Client-facing entry point for upload — thin wrapper so revalidatePath
// stays consistent with how every other mutation in this codebase triggers
// revalidation from the actions file, not from lib/.
export async function uploadMediaAsset(file: File, data: { altText: string; folder?: string; title?: string }) {
  try {
    const { asset, url } = await uploadAndRegisterMedia(file, data);
    revalidatePath("/admin/media");
    return { success: true, asset, url };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to upload media asset:", error);
    return { success: false, error: error.message || "Upload failed" };
  }
}

export async function updateMediaMetadata(id: string, data: { title?: string; altText: string; folder?: string }) {
  try {
    await requirePermission("MEDIA_MANAGEMENT");
    const altText = data.altText?.trim();
    if (!altText) {
      return { success: false, error: "Alt text is required" };
    }

    const before = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!before) {
      return { success: false, error: "Asset not found" };
    }

    const asset = await prisma.mediaAsset.update({
      where: { id },
      data: {
        title: data.title?.trim() || before.title,
        altText,
        folder: data.folder?.trim() || before.folder,
      },
    });

    revalidatePath("/admin/media");
    await logAudit({
      action: "update",
      category: "Media",
      entityType: "MediaAsset",
      entityId: id,
      entityLabel: asset.title,
      before: { title: before.title, altText: before.altText, folder: before.folder },
      after: { title: asset.title, altText: asset.altText, folder: asset.folder },
    });
    return { success: true, asset };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to update media asset ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function replaceMediaAsset(id: string, file: File, altText?: string) {
  try {
    await requirePermission("MEDIA_MANAGEMENT");
    const existing = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Asset not found" };
    }

    const data = await uploadToCloudinary(file, "tbj-growth");

    const asset = await prisma.mediaAsset.update({
      where: { id },
      data: {
        publicId: data.public_id,
        url: data.secure_url,
        filename: data.original_filename,
        format: data.format,
        width: data.width,
        height: data.height,
        bytes: data.bytes,
        altText: altText?.trim() || existing.altText,
      },
    });

    // Best-effort — the DB row is already updated to the new asset even if
    // the old Cloudinary file fails to delete; a stray orphaned Cloudinary
    // asset is a much smaller problem than losing the replace entirely.
    try {
      await destroyImage(existing.publicId);
    } catch (destroyError) {
      console.error(`Failed to destroy old Cloudinary asset ${existing.publicId}:`, destroyError);
    }

    revalidatePath("/admin/media");
    await logAudit({
      action: "replace",
      category: "Media",
      entityType: "MediaAsset",
      entityId: id,
      entityLabel: asset.title,
      before: { url: existing.url, publicId: existing.publicId, bytes: existing.bytes, format: existing.format },
      after: { url: asset.url, publicId: asset.publicId, bytes: asset.bytes, format: asset.format },
    });
    return { success: true, asset };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to replace media asset ${id}:`, error);
    return { success: false, error: error.message || "Replace failed" };
  }
}

export async function deleteMediaAsset(id: string) {
  try {
    await requirePermission("MEDIA_MANAGEMENT");
    const existing = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Asset not found" };
    }

    try {
      await destroyImage(existing.publicId);
    } catch (destroyError) {
      console.error(`Failed to destroy Cloudinary asset ${existing.publicId}:`, destroyError);
    }

    await prisma.mediaAsset.delete({ where: { id } });
    revalidatePath("/admin/media");
    await logAudit({
      action: "delete",
      category: "Media",
      entityType: "MediaAsset",
      entityId: id,
      entityLabel: existing.title,
      before: { url: existing.url, folder: existing.folder, altText: existing.altText, filename: existing.filename },
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to delete media asset ${id}:`, error);
    return { success: false, error: error.message };
  }
}
