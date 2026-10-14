"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit-log";
import { requireSession, requirePermission, AuthError } from "@/lib/auth-guard";
import {
  generateTwoFactorSecret,
  generateQrCodeSvg,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCodes,
} from "@/lib/totp";
import { listAdminSessions, revokeAdminSession, revokeAllOtherAdminSessions } from "@/lib/session-tracking";

// ------------------------------------------------------
// Two-factor auth
// ------------------------------------------------------

// Generates and stores a pending secret (twoFactorEnabled stays false until
// confirmTwoFactorSetup proves the user can actually generate a code with
// it) and returns the QR code to scan. Calling this again before confirming
// just overwrites the pending secret — no state to clean up.
export async function beginTwoFactorSetup() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.email) return { success: false, error: "Account has no email on file" };

    const { secret, uri } = generateTwoFactorSecret(user.email);
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret, twoFactorEnabled: false } });
    const qrSvg = await generateQrCodeSvg(uri);
    return { success: true, secret, qrSvg };
  } catch (error: any) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to begin 2FA setup:", error);
    return { success: false, error: "Failed to start two-factor setup" };
  }
}

export async function confirmTwoFactorSetup(code: string) {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.twoFactorSecret || !user.email) {
      return { success: false, error: "No pending two-factor setup. Start setup again." };
    }

    if (!verifyTotpCode(user.twoFactorSecret, code, user.email)) {
      return { success: false, error: "Incorrect code. Check your authenticator app and try again." };
    }

    const backupCodes = generateBackupCodes();
    const hashed = await hashBackupCodes(backupCodes);
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true, twoFactorBackupCodes: hashed },
    });

    await logAudit({
      action: "update",
      category: "Users",
      entityType: "User",
      entityId: user.id,
      entityLabel: user.email,
      after: { twoFactorEnabled: true },
    });

    // Shown exactly once — only the hashes are kept from here on.
    return { success: true, backupCodes };
  } catch (error: any) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to confirm 2FA setup:", error);
    return { success: false, error: "Failed to enable two-factor authentication" };
  }
}

export async function disableTwoFactor(password: string) {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.password) return { success: false, error: "Account not found" };

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return { success: false, error: "Incorrect password" };

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: null },
    });

    await logAudit({
      action: "update",
      category: "Users",
      entityType: "User",
      entityId: user.id,
      entityLabel: user.email,
      after: { twoFactorEnabled: false },
    });

    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to disable 2FA:", error);
    return { success: false, error: "Failed to disable two-factor authentication" };
  }
}

export async function regenerateBackupCodes(password: string) {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.password) return { success: false, error: "Account not found" };
    if (!user.twoFactorEnabled) return { success: false, error: "Two-factor authentication isn't enabled" };

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return { success: false, error: "Incorrect password" };

    const backupCodes = generateBackupCodes();
    const hashed = await hashBackupCodes(backupCodes);
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorBackupCodes: hashed } });

    return { success: true, backupCodes };
  } catch (error: any) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to regenerate backup codes:", error);
    return { success: false, error: "Failed to regenerate backup codes" };
  }
}

export async function getMyTwoFactorStatus() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { twoFactorEnabled: true } });
    return { enabled: user?.twoFactorEnabled ?? false };
  } catch {
    return { enabled: false };
  }
}

// ------------------------------------------------------
// Device/session list
// ------------------------------------------------------

export async function getMySessions() {
  try {
    const session = await requireSession();
    const sessions = await listAdminSessions(session.user.id);
    return { success: true, sessions, currentSessionId: session.user.sessionId };
  } catch (error) {
    console.error("Failed to fetch sessions:", error);
    return { success: false, sessions: [], currentSessionId: undefined };
  }
}

export async function revokeMySession(sessionId: string) {
  try {
    const session = await requireSession();
    const ok = await revokeAdminSession(sessionId, session.user.id);
    if (!ok) return { success: false, error: "Session not found" };
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to revoke session:", error);
    return { success: false, error: "Failed to revoke session" };
  }
}

export async function revokeAllOtherSessions() {
  try {
    const session = await requireSession();
    const count = await revokeAllOtherAdminSessions(session.user.id, session.user.sessionId);
    return { success: true, count };
  } catch (error: any) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to revoke other sessions:", error);
    return { success: false, error: "Failed to revoke other sessions" };
  }
}

// ------------------------------------------------------
// Login history / failed-login monitoring
// ------------------------------------------------------

export async function getMyLoginHistory(limit = 20) {
  try {
    const session = await requireSession();
    if (!session.user.email) return { success: true, attempts: [] };
    const attempts = await prisma.loginAttempt.findMany({
      where: { email: session.user.email },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return { success: true, attempts };
  } catch (error) {
    console.error("Failed to fetch login history:", error);
    return { success: false, attempts: [] };
  }
}

// Admin-wide view across every account — the "failed login monitoring"
// surface. Gated the same way Leads/Audit Log are (USER_MANAGEMENT), since
// it's account-security data about every team member, not just the viewer.
export async function getAllLoginHistory(limit = 100) {
  try {
    await requirePermission("USER_MANAGEMENT");
    const attempts = await prisma.loginAttempt.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return { success: true, attempts };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, attempts: [] };
    console.error("Failed to fetch login history:", error);
    return { success: false, attempts: [] };
  }
}
