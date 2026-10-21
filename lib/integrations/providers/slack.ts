import type { TestResult } from "../types";

/** Slack's own "is this token valid" endpoint — costs nothing, needs no channel/scope beyond a bot token existing. */
export async function testSlackConnection(credentials: Record<string, string>): Promise<TestResult> {
  const botToken = credentials.botToken?.trim();
  if (!botToken) return { ok: false, error: "Bot token is required" };

  try {
    const res = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: { Authorization: `Bearer ${botToken}` },
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.error || "Slack rejected this token" };
    return { ok: true, metadata: { team: data.team || "", botName: data.user || "" } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not reach Slack" };
  }
}

/** Posts a plain-text message to a channel — used by the automation engine's NOTIFY_TEAM action. Throws on failure so the caller can record it as a failed step. */
export async function postSlackMessage(botToken: string, channel: string, text: string): Promise<void> {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${botToken}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ channel, text }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Slack rejected this message");
}
