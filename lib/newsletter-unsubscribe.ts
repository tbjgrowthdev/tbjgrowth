import { createHmac, timingSafeEqual } from "node:crypto";
import { getNextAuthSecret } from "@/lib/env";

// Signed unsubscribe links for newsletter emails:
//   <base>/api/newsletter/unsubscribe?s=<subscriberId>&t=<token>
// The token is an HMAC of the subscriber id, so a link can't be forged or
// pointed at someone else, and it never expires (an old email's link keeps
// working). It's keyed off NEXTAUTH_SECRET: rotating that secret makes links
// in emails already sent stop working, so their recipients would have to use
// a newer email's link instead.

const PURPOSE = "newsletter-unsubscribe:v1:";

export function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com").replace(/\/+$/, "");
}

export function unsubscribeToken(subscriberId: string): string {
  return createHmac("sha256", getNextAuthSecret()).update(PURPOSE + subscriberId).digest("base64url");
}

export function verifyUnsubscribeToken(subscriberId: string, token: string): boolean {
  if (!subscriberId || !token) return false;
  const expected = Buffer.from(unsubscribeToken(subscriberId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function unsubscribeUrl(subscriberId: string): string {
  const params = new URLSearchParams({ s: subscriberId, t: unsubscribeToken(subscriberId) });
  return `${siteBaseUrl()}/api/newsletter/unsubscribe?${params}`;
}
