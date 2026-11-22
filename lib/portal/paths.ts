// The only in-app destinations the Client Hub accepts from untrusted input
// (push payloads, ?from= after sign-in). Edge-safe, no dependencies.

/**
 * `path` if it is a same-origin /portal path (optionally with a query), or
 * null. Rejects /admin, absolute and protocol-relative URLs, javascript:,
 * backslashes, control characters and any ".." segment (also encoded).
 */
export function safePortalPath(path: unknown): string | null {
  if (typeof path !== "string" || path.length === 0 || path.length > 512) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(path)) return null;
  if (!(path === "/portal" || path.startsWith("/portal/") || path.startsWith("/portal?"))) return null;

  const pathname = path.split(/[?#]/)[0];
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.split("/").some((seg) => seg === ".." || seg === ".")) return null;
  if (decoded.includes("//") || decoded.includes("\\")) return null;
  return path;
}
