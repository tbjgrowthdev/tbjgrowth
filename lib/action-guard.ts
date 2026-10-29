import { AuthError, requirePermission, requireSession } from "@/lib/auth-guard";
import type { Permission } from "@/lib/permissions";

// Action-level auth for thin Server Action wrappers in app/(admin)/actions/.
// Most of those wrappers forward to a lib function that already checks the
// same permission itself — this is the second, outer check (defense in depth),
// so a lib function that later loses its own check still can't be called
// unauthenticated through its action.
//
// "SESSION" means "any signed-in admin" (requireSession); anything else is a
// requirePermission() check. An AuthError never escapes: mutations get the
// usual { success: false, error }, readers get the same empty value their lib
// function already returns when it denies access, so callers see no new shape.

export type ActionAccess = Permission | "SESSION";

type Denied = { success: false; error: string };

async function check(access: ActionAccess) {
  return access === "SESSION" ? requireSession() : requirePermission(access);
}

/** For mutations: returns `{ success: false, error }` when access is denied. */
export async function guardMutation<T>(access: ActionAccess, run: () => Promise<T>): Promise<T | Denied> {
  try {
    await check(access);
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Action auth check failed:", error);
    return { success: false, error: "Authorization check failed" };
  }
  return run();
}

/** For readers: returns `fallback()` when access is denied. */
export async function guardRead<T, F>(access: ActionAccess, fallback: () => F, run: () => Promise<T>): Promise<T | F> {
  try {
    await check(access);
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("Action auth check failed:", error);
    return fallback();
  }
  return run();
}
