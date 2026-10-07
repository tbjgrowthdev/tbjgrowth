"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireSession, requirePermission, AuthError } from "@/lib/auth-guard";
import { canManageUserWithRole, getPermissions, ALL_ROLES, type Permission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit-log";
import type { Role } from "@prisma/client";

// Lighter-weight than getAdmins — any authenticated team member can see who's
// eligible for a given role in the approval workflow (assigning a reviewer
// shouldn't require USER_MANAGEMENT), just name/email/role, not the full
// team-management view.
export async function getAssignableUsers(permission: Permission) {
  try {
    await requireSession();
    const users = await prisma.user.findMany({
      where: { role: { in: ALL_ROLES } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
    return users.filter((u) => getPermissions(u.role).includes(permission));
  } catch (error) {
    console.error("Failed to fetch assignable users:", error);
    return [];
  }
}

export async function getAdmins() {
  try {
    await requirePermission("USER_MANAGEMENT");
    return await prisma.user.findMany({
      where: { role: { in: ALL_ROLES } },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch team members:", error);
    return [];
  }
}

export async function createAdmin(data: { name: string; email: string; password?: string; role: Role }) {
  try {
    const session = await requirePermission("USER_MANAGEMENT");

    if (!ALL_ROLES.includes(data.role)) {
      return { success: false, error: "Invalid role" };
    }
    if (!canManageUserWithRole(session.user.role, data.role)) {
      return { success: false, error: "You cannot create a user with this role" };
    }

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
        role: data.role,
      },
    });

    revalidatePath("/admin/admins");
    await logAudit({
      action: "create",
      category: "Users",
      entityType: "User",
      entityId: newAdmin.id,
      entityLabel: newAdmin.email,
      after: { name: newAdmin.name, email: newAdmin.email, role: newAdmin.role },
    });
    return { success: true, admin: newAdmin };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create team member:", error);
    return { success: false, error: error.message };
  }
}

export async function updateAdminRole(id: string, role: Role) {
  try {
    const session = await requirePermission("USER_MANAGEMENT");

    if (!ALL_ROLES.includes(role)) {
      return { success: false, error: "Invalid role" };
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return { success: false, error: "User not found" };
    }
    if (!canManageUserWithRole(session.user.role, target.role) || !canManageUserWithRole(session.user.role, role)) {
      return { success: false, error: "You cannot assign this role" };
    }
    if (target.id === session.user.id) {
      return { success: false, error: "You cannot change your own role" };
    }

    await prisma.user.update({ where: { id }, data: { role } });
    revalidatePath("/admin/admins");
    await logAudit({
      action: "update",
      category: "Roles",
      entityType: "User",
      entityId: id,
      entityLabel: target.email,
      before: { role: target.role },
      after: { role },
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to update role for ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function deleteAdmin(id: string) {
  try {
    const session = await requirePermission("USER_MANAGEMENT");

    if (id === session.user.id) {
      return { success: false, error: "You cannot delete your own account" };
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return { success: false, error: "User not found" };
    }
    if (!canManageUserWithRole(session.user.role, target.role)) {
      return { success: false, error: "You cannot delete this user" };
    }

    await prisma.user.delete({
      where: { id },
    });
    revalidatePath("/admin/admins");
    await logAudit({
      action: "delete",
      category: "Users",
      entityType: "User",
      entityId: id,
      entityLabel: target.email,
      before: { name: target.name, email: target.email, role: target.role },
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to delete team member ${id}:`, error);
    return { success: false, error: error.message };
  }
}
