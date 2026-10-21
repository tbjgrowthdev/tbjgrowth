import type { TestResult } from "../types";

/** WordPress's REST API, authenticated with an Application Password (Basic auth) — /users/me is the cheapest authenticated call that proves the credentials actually work. */
export async function testWordPressConnection(credentials: Record<string, string>): Promise<TestResult> {
  const siteUrl = credentials.siteUrl?.trim().replace(/\/+$/, "");
  const username = credentials.username?.trim();
  const applicationPassword = credentials.applicationPassword?.trim();
  if (!siteUrl || !username || !applicationPassword) return { ok: false, error: "Site URL, username, and application password are all required" };

  try {
    const auth = Buffer.from(`${username}:${applicationPassword}`).toString("base64");
    const res = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) return { ok: false, error: `WordPress rejected these credentials (HTTP ${res.status})` };
    const data = await res.json();
    return { ok: true, metadata: { siteUrl, user: data.name || username } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not reach this WordPress site" };
  }
}
