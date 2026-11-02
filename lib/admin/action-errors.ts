// Client-safe helpers for admin UI handlers that call Server Actions.
//
// A Server Action call rejects (instead of returning { success: false })
// when the request itself fails: the connection drops, the server returns
// a 5xx, or the deployment changed underneath the page. Any handler that
// sets a busy flag before awaiting one must reset it in `finally` and show
// this message in `catch`, or the spinner stays on forever.

export function describeActionError(error: unknown, fallback = "Something went wrong"): string {
  const message = (error as Error)?.message || "";
  if (/network|failed to fetch|load failed|connection/i.test(message) || (error as Error)?.name === "TypeError") {
    return "Lost connection to the server before it answered. Check your connection and try again — if this was a save, reload first to see whether it went through.";
  }
  if (/Server Action .* was not found|failed-to-find-server-action/i.test(message)) {
    return "This page is out of date (the site was redeployed). Reload the page and try again.";
  }
  return message ? `${fallback}: ${message}` : fallback;
}

export type StageResponse = { success: boolean; error?: string; connectionLost?: boolean };

/**
 * Calls the streaming stage endpoint (app/api/admin/ai-pipeline/[id]/stage).
 * The body is blank heartbeat lines followed by one JSON result line. Never
 * throws: a dropped connection, a timeout or a stream that ends without a
 * result comes back as `connectionLost: true`, meaning "outcome unknown —
 * check the job list".
 */
export async function requestPipelineStage(runId: string, stage: string, timeoutMs = 20 * 60 * 1000): Promise<StageResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`/api/admin/ai-pipeline/${encodeURIComponent(runId)}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.body) return { success: false, connectionLost: true, error: "The server sent no response." };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
    }
    buffered += decoder.decode();

    const lastLine = buffered.split("\n").map((l) => l.trim()).filter(Boolean).pop();
    if (!lastLine) return { success: false, connectionLost: true, error: "The connection closed before the stage reported a result." };
    try {
      const parsed = JSON.parse(lastLine) as StageResponse;
      return { success: !!parsed.success, error: parsed.error };
    } catch {
      return { success: false, error: res.ok ? "The server sent an unreadable response." : `The server returned an error (${res.status}).` };
    }
  } catch (error) {
    const aborted = (error as Error)?.name === "AbortError";
    return {
      success: false,
      connectionLost: true,
      error: aborted ? "Stopped waiting for the server after 20 minutes." : "Lost connection to the server while the stage was running.",
    };
  } finally {
    clearTimeout(timer);
  }
}
