import type { TestResult } from "../types";

/** Graph API's /me is the standard "is this access token valid" check — works for a page or user token without needing to know which ad account/page it's for yet. */
export async function testMetaConnection(credentials: Record<string, string>): Promise<TestResult> {
  const accessToken = credentials.accessToken?.trim();
  if (!accessToken) return { ok: false, error: "Access token is required" };

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(accessToken)}`);
    const data = await res.json();
    if (data.error) return { ok: false, error: data.error.message || "Meta rejected this access token" };
    return { ok: true, metadata: { account: data.name || data.id || "" } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not reach the Meta Graph API" };
  }
}
