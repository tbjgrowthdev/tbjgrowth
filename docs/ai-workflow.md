# AI Workflow

Architectural overview of the AI Content Pipeline. For setup, provider switching, cost tracking, prompt/brand-KB editing, and detailed per-stage behavior, see the operational runbook: **[docs/runbooks/ai-content-pipeline.md](./runbooks/ai-content-pipeline.md)** — this page exists to show how the pipeline fits into the rest of the system, not to repeat that runbook.

## Pipeline stages

`ContentPipelineRun.stage` (`PipelineStage` enum, `prisma/schema.prisma`) tracks one run's progress for a single Post or CaseStudy:

```
BRIEF → SEARCH_INTENT → RESEARCH → OUTLINE → DRAFT → IMAGE → SEO → INTERNAL_LINKS → SCHEMA → QA → APPROVAL → PUBLISHED
```

Two enum values exist outside this state machine (not in `PIPELINE_STAGE_ORDER`, `lib/content-pipeline/types.ts`) — they only tag `AiJob` rows so the Job Queue and Cost Dashboard can show/price those calls alongside normal pipeline jobs:

- `REFRESH` — AI calls made by the separate Content Refresh Engine (`lib/content-refresh/`).
- `PERFORMANCE_FEEDBACK` — the AI diagnosis call behind SEO Performance Feedback (`lib/seo-performance-feedback/`).

Nothing is written to the real CMS tables until the **Draft** stage, which calls the existing `createPost`/`createCaseStudy` actions. From Draft onward, every later stage reads and writes the real Post/CaseStudy row directly — there is exactly one copy of the content, never a pipeline-side copy reconciled later.

## Provider abstraction

`lib/content-pipeline/providers/` isolates everything provider-specific behind one interface; every text stage calls whichever one is active via `lib/content-pipeline/ai.ts`'s `callAiForJson()` — no stage or prompt file references a provider by name. The image provider (`openai` | `gemini`) is a separate selection for the Image stage only, since Anthropic has no image-generation API.

**Which provider is active** is resolved on every AI call by `providers/config.ts`'s `resolveAiConfig()`: a Super Admin's choice in **Settings → AI Provider** (the single-row `AiSettings` table — provider and optional model, for text and images independently) if one is saved, otherwise the `AI_PROVIDER` / `AI_IMAGE_PROVIDER` / `*_MODEL` env vars. Any error reading `AiSettings` falls back to the env vars rather than failing the AI call. Settings refuses to select a provider that has no key.

**Which API key is used** is resolved per call by `providers/keys.ts`'s `getAiApiKey(provider)`: a key an admin entered under **Settings → AI Provider → API keys** (an `Integration` row — `ANTHROPIC`, `OPENAI`, `GEMINI`, `XAI`, `OPENROUTER` or `CEREBRAS` — whose `encryptedCredentials` is AES-256-GCM ciphertext of `{ apiKey }` via `lib/integrations/crypto.ts`, with only `{ last4 }` in `metadata`), otherwise the provider's `*_API_KEY` env var. A missing table or enum value, a DB error or a failed decryption is logged (provider name only) and falls back to the env var — never a failed AI call. The full key is never returned to the browser, logged or written to the Audit Log; the UI shows only `••••` + the last 4 characters. Per provider, Settings shows where the key comes from (configured here / env var / not configured) with **Save/Replace key**, **Remove key** and **Test connection**. This is the only screen for AI keys: the Integration Hub's "AI Providers" row links here rather than offering a second form. Audit Log entries (category Integrations): `ai_key_set`, `ai_key_replaced`, `ai_key_removed` (provider name + actor, never the key) and `ai_provider_switched`.

**Providers:** `anthropic`, `openai` and `gemini` have their own files; `xai`, `openrouter` and `cerebras` share one generic OpenAI-compatible implementation (`providers/openai-compatible.ts`, parameterized by base URL and each API's documented output-cap parameter: `max_completion_tokens` for xAI and Cerebras, `max_tokens` for OpenRouter). OpenRouter model ids are `vendor/model`, so `/` is allowed in model names for OpenRouter only; every other provider keeps the strict pattern (Gemini puts the model name in its URL path). A response with no usage counts records 0 tokens flagged as unknown, and its job's cost is stored as unknown (`null`), not $0. Image generation stays OpenAI/Gemini only.

Settings also has a "Test text provider" button that makes one tiny real completion against the chosen provider/model before saving. Gated on `INTEGRATION_MANAGEMENT` (Super Admin only); every save is written to the Audit Log under Integrations.

A model name outside `lib/content-pipeline/pricing.ts`'s rate tables still runs normally, but its jobs record `costUsd = null` (the Settings form warns about this as you type). Every `AiJob` row records the actual `provider`/`model` that ran it, so switching providers mid-project never misattributes a historical job.

## Job tracking (`AiJob`)

Every AI-calling stage is wrapped in a tracked `AiJob` — status, retry count, timing, token counts, and estimated cost. `AiJob` belongs to exactly one of three parents (`pipelineRunId` / `contentRefreshId` / `performanceFeedbackId`, exactly one set, enforced by convention not a DB constraint — Prisma has no native "exactly one of N FKs"):

- A `ContentPipelineRun` stage (the main pipeline above).
- A `ContentRefresh` cycle (`lib/content-refresh/`).
- A `PerformanceFeedback` diagnosis (`lib/seo-performance-feedback/`).

`idempotencyKey` (`"<parentId>:<stage>"`) means calling a stage action again after it already `COMPLETED` is a safe no-op; after `FAILED` it resumes the same job on manual retry. Image and Internal Links are the deliberate exceptions (Regenerate always does real work, new Job ID every time).

## Grounding: RAG and Brand Knowledge Base

Two independent context sources feed every AI call, not just Draft:

- **Brand Knowledge Base** (`lib/brand-kb/context.ts`) — voice, audience, services, forbidden terms, etc. Appended to *every* stage's system prompt, admin-editable at `/admin/brand-kb`, versioned the same way as the Prompt Library.
- **Retrieval** (`lib/rag/retrieve.ts`) — lexical (keyword-overlap, not vector/semantic) search over approved Pages, Services, CaseStudies, FAQs, Brand KB docs, and published Posts, run once during Research and reused by Draft. Never surfaces unapproved/draft content as a factual source.

## Where this connects to the rest of the system

- **CMS Workflow** (`lib/workflow.ts`) — the APPROVAL stage's "Submit for review" / "Schedule" / "Publish Now" actions call `transitionContent` directly (`lib/content-pipeline/stages.ts`). Publishing through the pipeline is not a separate mechanism from publishing a hand-written draft; it's the same permission-gated state machine. See [CMS Workflow](./cms-workflow.md).
- **SEO Performance Feedback** (`lib/seo-performance-feedback/`) feeds back into the pipeline at the `AiJob` level only, via the `PERFORMANCE_FEEDBACK` stage tag described above — it diagnoses already-published content's SEO/performance signals with its own AI call, tracked and priced through the same `AiJob` plumbing. It is not currently wired to inject its findings back into a pipeline run's own prompts (e.g. Draft/SEO stage context) — the connection today is shared job-tracking infrastructure, not a feedback loop into generation. Worth noting as a plausible future extension rather than something already built.
- **Content Refresh Engine**, **Content Recommendations**, **Content Cannibalization**, and **Content Health Score** are related but structurally separate features documented in full in the runbook above — they reuse the pipeline's AI/job/pricing/prompt-library plumbing but not its stage state machine (Refresh and Recommendations use AI; Cannibalization and Health Score are fully deterministic).

## Permissions

Running the pipeline through Human Approval needs `CREATE`/`EDIT` (same tier as writing content normally). Actually publishing still needs `PUBLISH`/`SCHEDULE` — a Contributor can run the whole pipeline and then only "Submit for review," same as the manual editorial path. See [Permission Matrix](./permission-matrix.md).
