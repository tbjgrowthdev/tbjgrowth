"use server";

import { cache } from "react";
import prisma from "@/lib/prisma";
import { AuthError, requireSession } from "@/lib/auth-guard";
import { revalidatePath, revalidatePublicSite } from "@/lib/revalidate";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit-log";

// Memoized per request: the admin layout and the page both need the current
// user. Kept as a non-exported helper (a "use server" file can only export
// async functions) keyed by user id; the auth check stays in the exported
// action below, and cache() never outlives a single request.
const loadAdminById = cache(async (id: string) => {
  try {
    return await prisma.user.findUnique({ where: { id } });
  } catch (error) {
    console.error("Failed to fetch current admin:", error);
    return null;
  }
});

export async function getCurrentAdmin() {
  // requireSession (not bare getServerSession) so a revoked session is refused too.
  const session = await requireSession().catch(() => null);
  if (!session) return null;
  return loadAdminById(session.user.id);
}

export async function updateProfile(data: {
  name: string;
  email: string;
  bio?: string;
  image?: string;
  socialLinks?: string;
}) {
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    return { success: false, error: error instanceof AuthError ? error.message : "Not authenticated" };
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing && existing.id !== session.user.id) {
      return { success: false, error: "A user with this email already exists" };
    }

    const before = await prisma.user.findUnique({ where: { id: session.user.id } });

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: data.name,
        email: data.email,
        bio: data.bio || null,
        image: data.image || null,
        socialLinks: data.socialLinks || null,
      },
    });

    revalidatePath("/admin", "layout");
    revalidatePublicSite();
    await logAudit({
      action: "update",
      category: "Users",
      entityType: "User",
      entityId: session.user.id,
      entityLabel: updated.email,
      before: before ? { name: before.name, email: before.email } : undefined,
      after: { name: updated.name, email: updated.email },
    });
    return { success: true, user: updated };
  } catch (error: any) {
    console.error("Failed to update profile:", error);
    return { success: false, error: error.message };
  }
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    return { success: false, error: error instanceof AuthError ? error.message : "Not authenticated" };
  }

  if (data.newPassword.length < 6) {
    return { success: false, error: "New password must be at least 6 characters" };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || !user.password) {
      return { success: false, error: "User not found" };
    }

    const isValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValid) {
      return { success: false, error: "Current password is incorrect" };
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 10);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    });

    await logAudit({
      action: "changePassword",
      category: "Users",
      entityType: "User",
      entityId: session.user.id,
      entityLabel: user.email,
    });
    return { success: true };
  } catch (error: any) {
    console.error("Failed to change password:", error);
    return { success: false, error: error.message };
  }
}
