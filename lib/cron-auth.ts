import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

// Shared CRON_SECRET check for every app/api/cron/* route. There is no browser
// session in a cron context, so callers (GitHub Actions, external schedulers)
// send `Authorization: Bearer <CRON_SECRET>`.

/**
 * Constant-time comparison of the Authorization header against the expected
 * `Bearer <secret>`. A length mismatch returns false early (timingSafeEqual
 * requires equal lengths); that reveals only the length, not the content.
 */
export function isValidCronAuthHeader(authHeader: string | null, secret: string): boolean {
  if (!authHeader) return false;
  const given = Buffer.from(authHeader, "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

/**
 * Returns the response to send if the request isn't an authorized cron call
 * (500 if CRON_SECRET isn't configured, 401 if the header is wrong), or null
 * if it is. `action` completes the log line "refusing to <action>".
 *
 *   const denied = requireCronAuth(req, "run the link check");
 *   if (denied) return denied;
 */
export function requireCronAuth(req: Request, action: string): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(`CRON_SECRET is not configured — refusing to ${action}.`);
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (!isValidCronAuthHeader(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
