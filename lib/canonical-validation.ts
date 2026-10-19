/**
 * Pure URL checks for canonical URLs — no DB, no server-only imports, so
 * this is safe to import from a "use client" admin component for live
 * validation as the admin types, as well as from server-side scans
 * (lib/canonical-hreflang.ts, lib/translation.ts).
 */

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** True when `url` is an absolute http(s) URL on this site's own domain. */
export function isSameOriginUrl(url: string): boolean {
  try {
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

export type CanonicalFieldStatus = "empty" | "valid" | "invalid" | "cross-domain" | "self";

/**
 * Live validation for the Canonical URL field in the admin SEO panel.
 * `selfUrl` is the content's own default URL, to flag a pointless
 * self-referencing override.
 */
export function validateCanonicalInput(value: string, selfUrl?: string): { status: CanonicalFieldStatus; message: string } {
  const trimmed = value.trim();
  if (!trimmed) return { status: "empty", message: "No override — the auto-generated canonical URL will be used." };

  if (!isAbsoluteHttpUrl(trimmed)) {
    return { status: "invalid", message: "Not a valid absolute URL — must start with http:// or https://" };
  }

  if (selfUrl && trimmed === selfUrl) {
    return { status: "self", message: "Same as the auto-generated URL — this override has no effect." };
  }

  if (!isSameOriginUrl(trimmed)) {
    return { status: "cross-domain", message: "Points to an external domain — confirm this is intentional. Note: this also suppresses hreflang for this content." };
  }

  return { status: "valid", message: "Valid canonical override." };
}
