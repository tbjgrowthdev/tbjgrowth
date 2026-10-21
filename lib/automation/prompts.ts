import { buildSystemPrompt } from "@/lib/content-pipeline/prompts";
import { DEFAULT_BODY_TEMPLATE, fillTemplate, resolvePrompt } from "@/lib/content-pipeline/prompt-library";

type Prompt = { system: string; user: string };

/** First real consumer of the SOCIAL prompt category authored ahead of time in PromptTemplate — see lib/content-pipeline/prompt-constants.ts. */
export async function buildSocialDraftPrompt(params: { title: string; excerpt: string; url: string }): Promise<Prompt> {
  const template = await resolvePrompt("SOCIAL");
  const instruction = template ? fillTemplate(template.bodyTemplate, params) : DEFAULT_BODY_TEMPLATE.SOCIAL!;

  return {
    system: await buildSystemPrompt(template?.systemPrompt),
    user: `Write social copy announcing this newly published content.

Title: ${params.title}
Excerpt: ${params.excerpt}
URL: ${params.url}

${instruction}

Reply with JSON exactly matching:
{
  "linkedinText": string (2-4 sentences, professional tone, include the URL),
  "twitterText": string (280 characters or fewer including the URL)
}`,
  };
}
