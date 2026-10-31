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
  // xAI's published rate for prompts under 200k tokens (docs.x.ai/docs/models,
  // checked 2026-10). Prompts of 200k+ tokens bill at double; the pipeline's
  // prompts are far below that.
  "xai:grok-4.3": { inputPer1M: 1.25, outputPer1M: 2.5 },
  // OpenRouter and Cerebras are deliberately absent: OpenRouter's price
  // depends on which upstream model/route serves the request, and no
  // Cerebras rate was verified. Their jobs record tokens with cost null.
};

export function estimateCostUsd(provider: string, model: string, inputTokens: number, outputTokens: number): number | null {
  const rates = RATES[`${provider}:${model}`];
  if (!rates) return null;
  return (inputTokens / 1_000_000) * rates.inputPer1M + (outputTokens / 1_000_000) * rates.outputPer1M;
}

// Flat USD per generated image — image models are priced per-image (or
// per-megapixel-tier), not per-token, so this is a separate table from
// RATES above rather than forcing image jobs through the token math.
// Same PLACEHOLDER caveat as RATES: not verified against a live pricing
// page. Unknown provider:model returns null, same honesty rule as above.
const IMAGE_RATES: Record<string, number> = {
  "openai:gpt-image-1": 0.04,
  "gemini:gemini-2.5-flash-image": 0.02,
};

export function estimateImageCostUsd(provider: string, model: string): number | null {
  return IMAGE_RATES[`${provider}:${model}`] ?? null;
}

function splitKeys(table: Record<string, unknown>) {
  return Object.keys(table).map((key) => {
    const [provider, ...rest] = key.split(":");
    return { provider, model: rest.join(":") };
  });
}

/** Which provider/model pairs the tables above can price — shown in Settings → AI Provider so an admin knows a model outside this list records no cost. */
export const PRICED_TEXT_MODELS = splitKeys(RATES);
export const PRICED_IMAGE_MODELS = splitKeys(IMAGE_RATES);
