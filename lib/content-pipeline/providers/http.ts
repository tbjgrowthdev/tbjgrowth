import { AiProviderError } from "./types";

// Upper bound for one AI provider HTTP call. Without it a provider that
// stops responding leaves the stage (and its AiJob row) stuck in PROCESSING
// for as long as the runtime keeps the request alive. A long Draft (8k
// output tokens) normally takes 1–3 minutes, so the default leaves headroom.
const DEFAULT_TEXT_TIMEOUT_MS = 240_000;
const DEFAULT_IMAGE_TIMEOUT_MS = 180_000;

function timeoutFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function textRequestTimeoutMs() {
  return timeoutFromEnv("AI_REQUEST_TIMEOUT_MS", DEFAULT_TEXT_TIMEOUT_MS);
}

export function imageRequestTimeoutMs() {
  return timeoutFromEnv("AI_IMAGE_REQUEST_TIMEOUT_MS", DEFAULT_IMAGE_TIMEOUT_MS);
}

/**
 * fetch() plus a hard timeout, and network failures turned into
 * AiProviderError so the stage records a readable reason on the job.
 * Returns a function to read the JSON body under the same timeout — the
 * abort signal also covers a response body that stalls halfway through.
 */
export async function providerFetch(label: string, url: string, init: RequestInit, timeoutMs: number) {
  const signal = AbortSignal.timeout(timeoutMs);
  const wrap = (error: unknown): AiProviderError => {
    if (error instanceof AiProviderError) return error;
    const name = (error as { name?: string })?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      return new AiProviderError(`${label} did not respond within ${Math.round(timeoutMs / 1000)}s — the request was cancelled. Try again.`);
    }
    return new AiProviderError(`Could not reach ${label}: ${(error as Error)?.message || String(error)}`);
  };

  let res: Response;
  try {
    res = await fetch(url, { ...init, signal });
  } catch (error) {
    throw wrap(error);
  }
  return {
    res,
    async text() {
      try {
        return await res.text();
      } catch (error) {
        throw wrap(error);
      }
    },
    async json<T>(): Promise<T> {
      try {
        return (await res.json()) as T;
      } catch (error) {
        if (error instanceof SyntaxError) throw new AiProviderError(`${label} returned a response that was not valid JSON`);
        throw wrap(error);
      }
    },
  };
}
