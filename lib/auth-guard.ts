import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/permissions";

export class AuthError extends Error {}

// Every mutating (and most read) server action calls one of these first,
// inside its own try/catch, so an unauthorized call surfaces as the action's
// normal { success: false, error } shape instead of an unhandled rejection.
// This is deliberate defense-in-depth: middleware.ts already blocks
// unauthenticated navigation to /admin/*, but a Server Action is invoked by
// id and isn't re-checked per-action by the middleware's route matching, so
// relying on middleware alone would leave authorization implicit rather than
// enforced at the point every mutation actually happens.
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) {
    throw new AuthError("Not authenticated");
  }
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, permission)) {
    throw new AuthError(`Missing required permission: ${permission}`);
  }
  return session;
}
