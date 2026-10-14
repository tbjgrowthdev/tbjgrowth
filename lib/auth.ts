import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { ALL_ROLES } from "@/lib/permissions";
import { verifyTotpCode, verifyAndConsumeBackupCode } from "@/lib/totp";
import { createAdminSession } from "@/lib/session-tracking";
import { sendAccountLockedNotification } from "@/lib/email";

async function logAttempt(email: string, success: boolean, ip: string | null) {
  try {
    await prisma.loginAttempt.create({ data: { email, success, ip } });
  } catch (error) {
    console.error("Failed to log login attempt:", error);
  }
}

// Cloudflare sets cf-connecting-ip on every request it proxies; x-forwarded-for
// is the fallback for local dev (plain `next dev`, no Cloudflare in front).
function extractIp(headers: Record<string, string> | undefined | null): string | null {
  if (!headers) return null;
  return headers["cf-connecting-ip"] || headers["x-forwarded-for"]?.split(",")[0]?.trim() || null;
}

function extractUserAgent(headers: Record<string, string> | undefined | null): string | null {
  if (!headers) return null;
  return headers["user-agent"] || null;
}

// Brute-force lockout, built on the LoginAttempt log that already existed
// (it was being written on every attempt but nothing ever read it back).
// Keyed by email rather than IP: Cloudflare puts every request through its
// edge network, so the "IP" this app would see is frequently shared/
// rotating, while the attacked account is the one fixed, meaningful key.
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MAX_ATTEMPTS = 5;

async function isLockedOut(email: string): Promise<boolean> {
  try {
    const recentFailures = await prisma.loginAttempt.count({
      where: {
        email,
        success: false,
        createdAt: { gte: new Date(Date.now() - LOCKOUT_WINDOW_MS) },
      },
    });
    return recentFailures >= LOCKOUT_MAX_ATTEMPTS;
  } catch (error) {
    console.error("Failed to check login lockout state:", error);
    return false; // fail open — a DB hiccup here must never itself block legitimate logins
  }
}

// Fires exactly once per lockout, not on every attempt while already
// locked — called right after logging the failed attempt that pushes the
// count from (LOCKOUT_MAX_ATTEMPTS - 1) to LOCKOUT_MAX_ATTEMPTS.
async function notifyIfJustLockedOut(email: string) {
  try {
    const recentFailures = await prisma.loginAttempt.count({
      where: { email, success: false, createdAt: { gte: new Date(Date.now() - LOCKOUT_WINDOW_MS) } },
    });
    if (recentFailures === LOCKOUT_MAX_ATTEMPTS) {
      await sendAccountLockedNotification({ email, windowMinutes: LOCKOUT_WINDOW_MS / 60000 });
    }
  } catch (error) {
    console.error("Failed to check/send lockout notification:", error);
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@example.com" },
        password: { label: "Password", type: "password" },
        // Populated only on the login page's second step, once the server
        // has told it this account needs a code — see the "2FA_REQUIRED"
        // sentinel below and app/login/page.tsx.
        totpCode: { label: "Authenticator code", type: "text" },
        backupCode: { label: "Backup code", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }

        const ip = extractIp(req?.headers as Record<string, string> | undefined);
        const userAgent = extractUserAgent(req?.headers as Record<string, string> | undefined);

        if (await isLockedOut(credentials.email)) {
          throw new Error("Too many failed login attempts. Please try again in 15 minutes.");
        }

        // Check if ANY user exists at all. If not, bootstrap the very first
        // login as Super Admin — there's no other way to grant that role yet.
        const userCount = await prisma.user.count();

        if (userCount === 0) {
          const hashedPassword = await bcrypt.hash(credentials.password, 10);
          const newAdmin = await prisma.user.create({
            data: {
              email: credentials.email,
              password: hashedPassword,
              name: "System Admin",
              role: "SUPER_ADMIN",
            }
          });
          await logAttempt(credentials.email, true, ip);
          const sessionId = await createAdminSession(newAdmin.id, ip, userAgent);
          return {
            id: newAdmin.id,
            email: newAdmin.email,
            name: newAdmin.name,
            role: newAdmin.role,
            sessionId,
          };
        }

        // Standard login flow
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user || !user.password) {
          await logAttempt(credentials.email, false, ip);
          await notifyIfJustLockedOut(credentials.email);
          throw new Error("Invalid credentials");
        }

        if (!ALL_ROLES.includes(user.role)) {
          await logAttempt(credentials.email, false, ip);
          throw new Error("Access denied: You must be a team member.");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          await logAttempt(credentials.email, false, ip);
          await notifyIfJustLockedOut(credentials.email);
          throw new Error("Invalid credentials");
        }

        if (user.twoFactorEnabled) {
          const totpCode = credentials.totpCode?.trim();
          const backupCode = credentials.backupCode?.trim();

          if (!totpCode && !backupCode) {
            // Password was correct — don't log this as a failure, the
            // client is about to immediately retry with a code. The
            // sentinel string is matched exactly by app/login/page.tsx.
            throw new Error("2FA_REQUIRED");
          }

          let twoFactorValid = false;
          if (totpCode && user.twoFactorSecret) {
            twoFactorValid = verifyTotpCode(user.twoFactorSecret, totpCode, user.email!);
          } else if (backupCode) {
            const result = await verifyAndConsumeBackupCode(user.twoFactorBackupCodes, backupCode);
            twoFactorValid = result.valid;
            if (result.valid) {
              await prisma.user.update({ where: { id: user.id }, data: { twoFactorBackupCodes: result.remaining } });
            }
          }

          if (!twoFactorValid) {
            await logAttempt(credentials.email, false, ip);
            await notifyIfJustLockedOut(credentials.email);
            throw new Error("Invalid two-factor code");
          }
        }

        await logAttempt(credentials.email, true, ip);
        const sessionId = await createAdminSession(user.id, ip, userAgent);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sessionId,
        };
      }
    })
  ],
  pages: {
    signIn: '/login',
    error: '/login', // Redirect back to login on error
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.sub as string;
        session.user.role = token.role as string;
        session.user.sessionId = token.sessionId;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.sessionId = (user as { sessionId?: string }).sessionId;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development-only-replace-in-production",
};
