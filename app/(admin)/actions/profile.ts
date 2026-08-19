"use server";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

export async function getCurrentAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  try {
    return await prisma.user.findUnique({
      where: { id: session.user.id },
    });
  } catch (error) {
    console.error("Failed to fetch current admin:", error);
    return null;
  }
}

export async function updateProfile(data: {
  name: string;
  email: string;
  bio?: string;
  image?: string;
  socialLinks?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing && existing.id !== session.user.id) {
      return { success: false, error: "A user with this email already exists" };
    }

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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
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

    return { success: true };
  } catch (error: any) {
    console.error("Failed to change password:", error);
    return { success: false, error: error.message };
  }
}
