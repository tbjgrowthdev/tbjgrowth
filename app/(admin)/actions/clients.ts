"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { ALL_ROLES, hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit-log";
import { sendClientInvite } from "@/lib/email";
import { createCodeWithinLimits, normalizeEmail, revokeAllClientSessions } from "@/lib/portal/auth";

// Admin "Clients" section: client companies, their portal users and invites.
// Viewing needs CLIENT_UPDATES (editors post updates for these clients);
// every change here needs CLIENT_MANAGEMENT and is audit-logged.
//
// Neon HTTP: no transactions, no updateMany/createMany, no nested writes.
// Multi-step changes are ordered so a failure part-way leaves valid data
// (e.g. disabling sets the status first: a half-done disable still blocks
// sign-in, because requireClient() refuses DISABLED users).

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

function failure(error: unknown, fallback: string): { success: false; error: string } {
  if (error instanceof AuthError) return { success: false, error: error.message };
  console.error(`[clients] ${fallback}:`, error);
  return { success: false, error: fallback };
}

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v == null ? v : v.trim() || null));

const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  whatsapp: optionalText(40),
  phone: optionalText(40),
  notes: optionalText(5000),
  accountManagerId: z.string().max(100).optional().nullable(),
});

const clientUserSchema = z.object({
  email: z.string().max(254),
  name: z.string().trim().min(1, "Name is required").max(200),
  language: z.enum(["en", "bn"]),
});

function portalLoginUrl(language: "en" | "bn"): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowthtech.com").replace(/\/+$/, "");
  return `${base}/portal/login${language === "bn" ? "?lang=bn" : ""}`;
}

async function isStaffUser(id: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  return !!user && (ALL_ROLES as string[]).includes(user.role);
}

function revalidateClient(clientId?: string) {
  revalidatePath("/admin/clients");
  if (clientId) revalidatePath(`/admin/clients/${clientId}`);
}

// ---- reads (staff views; include staff-only fields such as notes) ----

/** What the signed-in staff member may do here, for showing or hiding controls. The actions re-check. */
export async function getClientsViewer() {
  try {
    const session = await requireSession();
    const role = session.user.role;
    return { canManage: hasPermission(role, "CLIENT_MANAGEMENT"), canUpdate: hasPermission(role, "CLIENT_UPDATES") };
  } catch {
    return { canManage: false, canUpdate: false };
  }
}

export async function listClientsForAdmin() {
  try {
    await requirePermission("CLIENT_UPDATES");
    return await prisma.client.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        accountManager: { select: { id: true, name: true } },
        _count: { select: { users: true, projects: true } },
      },
    });
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("[clients] list failed:", error);
    return [];
  }
}

export async function getClientForAdmin(id: string) {
  try {
    await requirePermission("CLIENT_UPDATES");
    return await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        whatsapp: true,
        phone: true,
        notes: true,
        accountManagerId: true,
        accountManager: { select: { id: true, name: true } },
        createdAt: true,
        users: {
          orderBy: { createdAt: "asc" },
          select: { id: true, email: true, name: true, language: true, status: true, lastLoginAt: true, deletionRequestedAt: true, createdAt: true },
        },
      },
    });
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("[clients] get failed:", error);
    return null;
  }
}

/** Staff who can be a client's account manager. */
export async function listAccountManagerOptions() {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    return await prisma.user.findMany({ where: { role: { in: ALL_ROLES } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } });
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("[clients] managers failed:", error);
    return [];
  }
}

// ---- clients ----

export async function createClient(input: z.input<typeof clientSchema>): Promise<Result<{ id: string }>> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    const parsed = clientSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    const { accountManagerId, ...rest } = parsed.data;
    if (accountManagerId && !(await isStaffUser(accountManagerId))) return { success: false, error: "Account manager must be a team member" };
    const client = await prisma.client.create({
      data: { name: rest.name, whatsapp: rest.whatsapp ?? null, phone: rest.phone ?? null, notes: rest.notes ?? null, accountManagerId: accountManagerId || null },
      select: { id: true, name: true },
    });
    await logAudit({ action: "create", category: "Users", entityType: "Client", entityId: client.id, entityLabel: client.name, after: { name: client.name } });
    revalidateClient();
    return { success: true, id: client.id };
  } catch (error) {
    return failure(error, "Couldn't create the client");
  }
}

export async function updateClient(id: string, input: Partial<z.input<typeof clientSchema>> & { name: string }): Promise<Result> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    const parsed = clientSchema.omit({ accountManagerId: true }).safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    const before = await prisma.client.findUnique({ where: { id }, select: { name: true, whatsapp: true, phone: true } });
    if (!before) return { success: false, error: "Client not found" };
    const data = parsed.data;
    await prisma.client.update({ where: { id }, data: { name: data.name, whatsapp: data.whatsapp, phone: data.phone, notes: data.notes } });
    await logAudit({ action: "update", category: "Users", entityType: "Client", entityId: id, entityLabel: data.name, before, after: { name: data.name, whatsapp: data.whatsapp, phone: data.phone } });
    revalidateClient(id);
    return { success: true };
  } catch (error) {
    return failure(error, "Couldn't update the client");
  }
}

export async function assignAccountManager(clientId: string, userId: string | null): Promise<Result> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    if (userId !== null && (typeof userId !== "string" || !(await isStaffUser(userId)))) {
      return { success: false, error: "Account manager must be a team member" };
    }
    const before = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true, accountManagerId: true } });
    if (!before) return { success: false, error: "Client not found" };
    await prisma.client.update({ where: { id: clientId }, data: { accountManagerId: userId } });
    await logAudit({
      action: "assign_manager",
      category: "Users",
      entityType: "Client",
      entityId: clientId,
      entityLabel: before.name,
      before: { accountManagerId: before.accountManagerId },
      after: { accountManagerId: userId },
    });
    revalidateClient(clientId);
    return { success: true };
  } catch (error) {
    return failure(error, "Couldn't change the account manager");
  }
}

// ---- client users ----

/** Emails a fresh code plus the portal link. False when the hourly code limit for that email is reached. */
async function sendInvite(user: { email: string; name: string; language: "en" | "bn" }): Promise<boolean> {
  const code = await createCodeWithinLimits(user.email, null, new Date());
  if (!code) return false;
  await sendClientInvite({ to: user.email, name: user.name, code, portalUrl: portalLoginUrl(user.language), language: user.language });
  return true;
}

export async function addClientUser(clientId: string, input: z.input<typeof clientUserSchema>): Promise<Result<{ id: string }>> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    const parsed = clientUserSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    const email = normalizeEmail(parsed.data.email);
    if (!email) return { success: false, error: "Enter a valid email address" };
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return { success: false, error: "Client not found" };
    if (await prisma.clientUser.findUnique({ where: { email }, select: { id: true } })) {
      return { success: false, error: "That email already has a portal account" };
    }
    let user;
    try {
      user = await prisma.clientUser.create({
        data: { clientId, email, name: parsed.data.name, language: parsed.data.language, status: "INVITED" },
        select: { id: true, email: true, name: true, language: true },
      });
    } catch (error) {
      // Lost a race with another invite for the same email (unique index).
      if ((error as { code?: string }).code === "P2002") return { success: false, error: "That email already has a portal account" };
      throw error;
    }
    const sent = await sendInvite(user);
    await logAudit({ action: "invite", category: "Users", entityType: "ClientUser", entityId: user.id, entityLabel: email, after: { clientId, email, name: user.name } });
    revalidateClient(clientId);
    return sent ? { success: true, id: user.id } : { success: false, error: "User added, but too many codes were sent to this email in the last hour. Resend the invite later." };
  } catch (error) {
    return failure(error, "Couldn't add the user");
  }
}

export async function resendInvite(clientUserId: string): Promise<Result> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    const user = await prisma.clientUser.findUnique({ where: { id: clientUserId }, select: { id: true, clientId: true, email: true, name: true, language: true, status: true } });
    if (!user) return { success: false, error: "User not found" };
    if (user.status === "DISABLED") return { success: false, error: "Enable this user before sending an invite" };
    if (!(await sendInvite(user))) return { success: false, error: "Too many codes were sent to this email in the last hour. Try again later." };
    await logAudit({ action: "resend_invite", category: "Users", entityType: "ClientUser", entityId: user.id, entityLabel: user.email });
    return { success: true };
  } catch (error) {
    return failure(error, "Couldn't resend the invite");
  }
}

export async function setClientUserDisabled(clientUserId: string, disabled: boolean): Promise<Result> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    if (typeof disabled !== "boolean") return { success: false, error: "Invalid input" };
    const user = await prisma.clientUser.findUnique({ where: { id: clientUserId }, select: { id: true, clientId: true, email: true, status: true, lastLoginAt: true } });
    if (!user) return { success: false, error: "User not found" };
    const status = disabled ? "DISABLED" : user.lastLoginAt ? "ACTIVE" : "INVITED";
    // Status first: from here on requireClient() refuses this user even if
    // the steps below fail part-way.
    await prisma.clientUser.update({ where: { id: user.id }, data: { status } });
    if (disabled) {
      await revokeAllClientSessions(user.id);
      await prisma.pushDevice.deleteMany({ where: { clientUserId: user.id } });
    }
    await logAudit({
      action: disabled ? "disable" : "enable",
      category: "Users",
      entityType: "ClientUser",
      entityId: user.id,
      entityLabel: user.email,
      before: { status: user.status },
      after: { status },
    });
    revalidateClient(user.clientId);
    return { success: true };
  } catch (error) {
    return failure(error, disabled ? "Couldn't disable the user" : "Couldn't enable the user");
  }
}

export async function revokeClientUserSessions(clientUserId: string): Promise<Result<{ revoked: number }>> {
  try {
    await requirePermission("CLIENT_MANAGEMENT");
    const user = await prisma.clientUser.findUnique({ where: { id: clientUserId }, select: { id: true, clientId: true, email: true } });
    if (!user) return { success: false, error: "User not found" };
    const revoked = await revokeAllClientSessions(user.id);
    await logAudit({ action: "revoke_sessions", category: "Users", entityType: "ClientUser", entityId: user.id, entityLabel: user.email, after: { revoked } });
    revalidateClient(user.clientId);
    return { success: true, revoked };
  } catch (error) {
    return failure(error, "Couldn't sign the user out");
  }
}
