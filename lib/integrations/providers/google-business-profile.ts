import type { TestResult } from "../types";

/**
 * A manually-pasted OAuth access token (not a dedicated consent flow —
 * that would need its own OAuth client, a Business Profile-specific scope,
 * and a location picker, a meaningfully larger feature than this hub's
 * architecture is scoped to). Listing accounts is the cheapest call that
 * proves the token actually has Business Profile access.
 */
export async function testGoogleBusinessProfileConnection(credentials: Record<string, string>): Promise<TestResult> {
  const accessToken = credentials.accessToken?.trim();
  if (!accessToken) return { ok: false, error: "Access token is required" };

  try {
    const res = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, error: `Google rejected this token (HTTP ${res.status}) — it may be expired or missing Business Profile access` };
    const data = await res.json();
    const firstAccount = data.accounts?.[0]?.accountName;
    return { ok: true, metadata: firstAccount ? { account: firstAccount } : {} };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not reach the Business Profile API" };
  }
}
