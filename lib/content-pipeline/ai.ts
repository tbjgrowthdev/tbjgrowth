import { getActiveProvider, AiProviderError } from "./providers";
import type { AiUsage } from "./providers/types";

export { AiProviderError };
export type { AiUsage };

/**
 * Calls the active AI provider with a system prompt + user prompt and
 * returns the parsed JSON object the model was instructed to reply with,
 * plus how many tokens that cost (summed across the repair attempt below,
 * if one happened — both calls are real, billed requests). Provider-
 * agnostic by design — see lib/content-pipeline/providers — so every
 * pipeline stage calls this one function regardless of which provider
 * AI_PROVIDER currently selects, and never touches token/cost accounting
 * itself; that's handled by the job-tracking layer (./jobs.ts) using the
 * `usage` returned here.
 *
 * The model is told to reply with ONLY a JSON object matching the given
 * shape description; if the first reply doesn't parse as JSON, one repair
 * attempt is made by sending the bad output back and asking for valid
 * JSON only — LLMs reliably fix their own formatting mistakes when shown
 * the parse error, and this is far cheaper than failing the whole
 * pipeline stage over a stray markdown code-fence.
 */
export async function callAiForJson<T>(system: string, userPrompt: string, maxTokens = 4096): Promise<{ data: T; usage: AiUsage }> {
  const provider = getActiveProvider();

  const first = await provider.complete(system, userPrompt, maxTokens);
  const parsed = tryParseJson<T>(first.text);
  if (parsed) return { data: parsed, usage: { inputTokens: first.inputTokens, outputTokens: first.outputTokens } };

  const repair = await provider.complete(
    system,
    `Your previous reply could not be parsed as JSON. Reply again with ONLY a single valid JSON object — no markdown code fences, no commentary before or after it. Previous reply:\n\n${first.text}`,
    maxTokens
  );
  const usage: AiUsage = {
    inputTokens: first.inputTokens + repair.inputTokens,
    outputTokens: first.outputTokens + repair.outputTokens,
  };
  const repaired = tryParseJson<T>(repair.text);
  if (repaired) return { data: repaired, usage };

  const error = new AiProviderError(`${provider.name} did not return valid JSON after one repair attempt`);
  error.usage = usage; // real cost was incurred even though the call ultimately failed
  throw error;
}

function tryParseJson<T>(text: string): T | null {
  // Strip a ```json ... ``` fence if the model added one despite being told not to.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate.trim()) as T;
  } catch {
    return null;
  }
}
