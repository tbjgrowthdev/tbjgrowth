// USD per 1,000,000 tokens, for the three default models this project
// ships with. PLACEHOLDER RATES — provider pricing changes over time and
// varies per exact model/region, and these were not verified against a
// live pricing page at the time this was written. Treat every dollar
// figure the cost dashboard shows as only as accurate as this table;
// update it against each provider's current pricing before trusting it
// for real budgeting.
//
// A provider:model combination NOT in this table returns `null` cost
// (never a silently wrong number) — AiJob.costUsd stays null, and the
// cost dashboard calls out how many jobs that affects rather than quietly
// excluding them from totals.
const RATES: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "anthropic:claude-sonnet-5-5": { inputPer1M: 3, outputPer1M: 15 },
  "openai:gpt-5": { inputPer1M: 1.25, outputPer1M: 10 },
  "gemini:gemini-2.5-flash": { inputPer1M: 0.3, outputPer1M: 2.5 },
};

export function estimateCostUsd(provider: string, model: string, inputTokens: number, outputTokens: number): number | null {
  const rates = RATES[`${provider}:${model}`];
  if (!rates) return null;
  return (inputTokens / 1_000_000) * rates.inputPer1M + (outputTokens / 1_000_000) * rates.outputPer1M;
}
