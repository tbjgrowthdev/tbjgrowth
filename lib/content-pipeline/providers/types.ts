// The one contract every AI provider implements. Nothing in
// lib/content-pipeline/stages.ts or prompts.ts ever imports a specific
// provider or checks which one is active — they only ever see this shape,
// via getActiveProvider() in ./index. That's the actual guarantee behind
// "switch providers/models without rewriting business logic": a stage
// function calls callAiForJson(system, prompt), which asks for whichever
// provider is configured and calls its one method — Claude, GPT, Gemini,
// or anything else implementing AiProvider are interchangeable from there.
export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AiCompletion extends AiUsage {
  text: string;
}

export interface AiProvider {
  name: string;
  model: string;
  complete(system: string, userPrompt: string, maxTokens: number): Promise<AiCompletion>;
}

export class AiProviderError extends Error {
  // Set when the provider DID respond (so real cost was incurred) but the
  // overall call still failed for some other reason — e.g. callAiForJson's
  // final "not valid JSON after one repair attempt". Lets the job-tracking
  // layer (lib/content-pipeline/jobs.ts) record cost on a FAILED job too,
  // instead of only ever on success.
  usage?: AiUsage;
}
