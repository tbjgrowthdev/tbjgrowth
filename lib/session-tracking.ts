import prisma from "@/lib/prisma";

// Device/session list backing this app's JWT-based auth — see AdminSession's
// schema comment for why this exists alongside (not instead of) NextAuth's
// own unused Session/Account models. Provider-agnostic on purpose: the
// Credentials provider calls createAdminSession from lib/auth.ts's
// authorize(), and a future SSO provider should call it the same way from
// wherever it captures ip/userAgent (NextAuth v4's jwt/session callbacks
// don't receive the raw request, so that capture has to happen
// provider-side, same as it does here).

const TOUCH_THROTTLE_MS = 5 * 60 * 1000;

export async function createAdminSession(userId: string, ip: string | null, userAgent: string | null): Promise<string> {
  const session = await prisma.adminSession.create({
    data: { userId, ip, userAgent },
  });
  return session.id;
}

export async function isSessionRevoked(sessionId: string | undefined | null): Promise<boolean> {
  if (!sessionId) return true;
  const session = await prisma.adminSession.findUnique({ where: { id: sessionId } });
  return !session || session.revokedAt !== null;
}

// Called from requireSession() on every authenticated request — throttled
// so it's a write only once per TOUCH_THROTTLE_MS per session, not on every
// single request.
export async function touchAdminSession(sessionId: string | undefined | null): Promise<void> {
  if (!sessionId) return;
  try {
    const session = await prisma.adminSession.findUnique({ where: { id: sessionId } });
    if (!session || Date.now() - session.lastSeenAt.getTime() < TOUCH_THROTTLE_MS) return;
    await prisma.adminSession.update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } });
  } catch (error) {
    console.error("Failed to touch admin session:", error);
  }
}

export async function listAdminSessions(userId: string) {
  return prisma.adminSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
  });
}

export async function revokeAdminSession(sessionId: string, userId: string): Promise<boolean> {
  const session = await prisma.adminSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) return false;
  await prisma.adminSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  return true;
}

export async function revokeAllOtherAdminSessions(userId: string, keepSessionId: string | undefined | null): Promise<number> {
  const result = await prisma.adminSession.updateMany({
    where: { userId, revokedAt: null, id: { not: keepSessionId ?? "" } },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
