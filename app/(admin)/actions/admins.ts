"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

export async function getAdmins() {
  try {
    return await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "EDITOR"] } },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch team members:", error);
    return [];
  }
}

export async function createAdmin(data: { name: string; email: string; password?: string; role?: "ADMIN" | "EDITOR" }) {
  try {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      return { success: false, error: "A user with this email already exists" };
    }

    const passwordToHash = data.password || "TBJAdmin123!"; // Fallback password
    const hashedPassword = await bcrypt.hash(passwordToHash, 10);

    const newAdmin = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role === "EDITOR" ? "EDITOR" : "ADMIN",
      },
    });

    revalidatePath("/admin/admins");
    return { success: true, admin: newAdmin };
  } catch (error: any) {
    console.error("Failed to create team member:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteAdmin(id: string) {
  try {
    await prisma.user.delete({
      where: { id },
    });
    revalidatePath("/admin/admins");
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to delete team member ${id}:`, error);
    return { success: false, error: error.message };
  }
}
