import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/permissions";
import { isSessionRevoked, touchAdminSession } from "@/lib/session-tracking";

export class AuthError extends Error {}

// Every mutating (and most read) server action calls one of these first,
// inside its own try/catch, so an unauthorized call surfaces as the action's
// normal { success: false, error } shape instead of an unhandled rejection.
// This is deliberate defense-in-depth: middleware.ts already blocks
// unauthenticated navigation to /admin/*, but a Server Action is invoked by
// id and isn't re-checked per-action by the middleware's route matching, so
// relying on middleware alone would leave authorization implicit rather than
// enforced at the point every mutation actually happens.
//
// The revocation check below is also why a revoked device/session actually
// stops working without this app switching to NextAuth's database session
// strategy (which CredentialsProvider can't use in v4, see AdminSession's
// schema comment): the JWT itself stays valid until it expires, but every
// server action re-checks the AdminSession row it points at, so "Revoke"
// in the sessions UI (app/(admin)/actions/security.ts) takes effect on the
// very next action the revoked device tries to perform — middleware.ts
// can't do this same check itself (no direct Prisma access in that Edge
// context, see lib/redirect-cache.ts), so this is the real enforcement
// point, same as permission checks already are.
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) {
    throw new AuthError("Not authenticated");
  }
  if (await isSessionRevoked(session.user.sessionId)) {
    throw new AuthError("This session has been revoked. Please sign in again.");
  }
  await touchAdminSession(session.user.sessionId);
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, permission)) {
    throw new AuthError(`Missing required permission: ${permission}`);
  }
  return session;
}
