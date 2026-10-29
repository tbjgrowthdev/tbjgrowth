// Shared env helpers. Edge-safe (only reads process.env), since middleware.ts
// runs on the edge runtime.

const DEV_FALLBACK_SECRET = "fallback-secret-for-development-only-replace-in-production";

let warnedAboutDevSecret = false;
let buildPlaceholder: string | undefined;

/**
 * The secret NextAuth signs and verifies session JWTs with. Used by both
 * lib/auth.ts (authOptions) and middleware.ts (withAuth), which must agree.
 *
 * - Set: returned as-is.
 * - Missing in production: throws. Never fall back there: the fallback is in
 *   this public repo, so anyone could forge an admin session with it.
 * - Missing in development: returns the fallback and warns once.
 *
 * Call it lazily (per request), not at module load. `next build` runs with
 * NODE_ENV=production and loads these modules, but on Cloudflare the secret
 * is a runtime-only Worker secret (docs/deployment.md), so a module-load
 * check would fail every build. The build phase is skipped explicitly too.
 */
export function getNextAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    // Nothing is signed during the build; a random value just keeps it from failing.
    if (process.env.NEXT_PHASE === "phase-production-build") return (buildPlaceholder ??= crypto.randomUUID());
    throw new Error(
      "NEXTAUTH_SECRET is not set. Refusing to sign or verify sessions with the development fallback in production. " +
        "Set it in Cloudflare → Workers & Pages → the Worker → Settings → Variables and Secrets (runtime secret, not a build variable)."
    );
  }

  if (!warnedAboutDevSecret) {
    warnedAboutDevSecret = true;
    console.warn("[auth] NEXTAUTH_SECRET is not set; using the development-only fallback secret. Never deploy like this.");
  }
  return DEV_FALLBACK_SECRET;
}
