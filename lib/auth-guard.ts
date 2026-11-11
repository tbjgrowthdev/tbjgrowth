import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/permissions";
import { checkAndTouchAdminSession } from "@/lib/session-tracking";

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
// Memoized per request render (React cache): a page that runs several loaders
// in Promise.all, plus the layout, verifies the session once instead of once
// per loader. cache() is scoped to a single server request, so nothing is
// shared across requests — a revoked session is refused on the very next
// request, and every Server Action invocation is its own request and re-checks.
// It resolves to a result instead of throwing so each caller gets its own
// fresh AuthError.
const verifySession = cache(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) {
    return { session: null, error: "Not authenticated" } as const;
  }
  if ((await checkAndTouchAdminSession(session.user.sessionId)) !== "active") {
    return { session: null, error: "This session has been revoked. Please sign in again." } as const;
  }
  return { session, error: null } as const;
});

export async function requireSession() {
  const result = await verifySession();
  if (!result.session) throw new AuthError(result.error);
  return result.session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, permission)) {
    throw new AuthError(`Missing required permission: ${permission}`);
  }
  return session;
}
