# AI Content Pipeline

`/admin/ai-pipeline` — Brief → Search Intent → Research → Outline → Draft → SEO → Internal Links → Schema → QA → Human Approval → Publish, for Blog Posts and Case Studies.

## Setup

Set in the environment (see `.env.example`):

- `AI_PROVIDER` — `anthropic` (default) | `openai` | `gemini`. Picks which provider every stage actually calls; see "Provider abstraction" below.
- `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`, `OPENAI_API_KEY` / `OPENAI_MODEL`, `GEMINI_API_KEY` / `GEMINI_MODEL` — only the pair matching the active `AI_PROVIDER` needs to be set. Without it, every AI-driven stage fails with "`<KEY>` is not configured" and the run just sits at its current stage (nothing is lost — re-run the stage once the key is set).
- `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` — already required for Keyword Tracking; also used here for real search-volume (Search Intent) and SERP competitor snippets (Research). If missing, those two stages still run — the model falls back to reasoning without live data instead of failing the stage.

## Provider abstraction

`lib/content-pipeline/providers/` isolates everything provider-specific behind one interface (`AiProvider`: a name, a model, and a single `complete(system, userPrompt, maxTokens)` method). `lib/content-pipeline/ai.ts`'s `callAiForJson()` — the only AI-calling function `stages.ts`/`prompts.ts` ever uses — asks `getActiveProvider()` for whichever provider `AI_PROVIDER` currently selects and calls that one method. No stage, prompt, or business logic references Anthropic, OpenAI, or Gemini by name anywhere outside `providers/`.

Switching provider or model is purely a config change: set `AI_PROVIDER` (and that provider's API key/model env vars) and the next stage run picks it up — no code changes. Adding a fourth provider means writing one new file (`providers/<name>.ts`, implementing `AiProvider`) and registering it in `providers/index.ts`'s `PROVIDER_FACTORIES` map; `stages.ts` never changes.

Each `AiJob` row (see below) records the actual `provider`/`model` that ran it at the time, read fresh on every attempt — so a run started on Claude and retried after switching `AI_PROVIDER` to GPT shows exactly that in its Job Log, rather than silently misattributing which model produced what.

## How a run works

- `ContentPipelineRun` (Prisma) tracks one run. Its `stage` field is the last stage completed; the wizard always offers to generate whichever stage comes next.
- Nothing is written to the real CMS tables until the **Draft** stage, which calls the existing `createPost`/`createCaseStudy` actions — same authorship, versioning, and audit-log behavior as a hand-written draft. `ContentPipelineRun.contentId` then points at that row.
- From Draft onward, every later stage (SEO, Internal Links, Schema) reads and writes the real Post/CaseStudy row directly — there is exactly one copy of the content, not a pipeline-side draft that gets copied over later.
- **Internal Links** never lets the model rewrite HTML: it can only pick an exact, verbatim substring from the existing content as anchor text and a URL from a list of real published pages; the server does the actual `<a href>` insertion via string replacement, then re-sanitizes.
- **QA** combines deterministic checks (meta length, keyword presence, word count — computed in code, not trusted to the model) with Claude's own qualitative review (tone, repetition, placeholder text). A failed check is advisory, shown to the human approver, and never blocks anything by itself.
- **Human Approval** is a plain manual gate (no AI call) — it does not grant publish rights. **Publish** still goes through the same `transitionContent`/`scheduleContentJob` the rest of the CMS uses, so someone without PUBLISH permission can only "Submit for review" from here, same as anywhere else.

## Permissions

Creating a brief and advancing stages requires `CREATE`/`EDIT` (same tier as writing content normally). Actually publishing still requires `PUBLISH` (or `SCHEDULE`) — a Contributor can run the whole pipeline up to Human Approval and then only "Submit for review."

## Job tracking (`AiJob`)

Every AI-calling stage (Search Intent, Research, Outline, Draft, SEO, Internal Links, Schema, QA) is wrapped in a tracked `AiJob` row — Job ID, Content ID (once known), Provider, Model, Status (`QUEUED`/`PROCESSING`/`COMPLETED`/`FAILED`), Error, Retry count, and timing (`queuedAt`/`startedAt`/`completedAt`). View them per-run in the wizard's "Job Log" panel, or all at once at `/admin/ai-pipeline/jobs`.

**Idempotency** is the actual point, not just bookkeeping: `idempotencyKey` is `"<pipelineRunId>:<stage>"`, so there is at most one job per stage per run. Calling a stage's action again after it already `COMPLETED` is a safe no-op — it returns the existing run without re-calling the AI provider or redoing any side effect (never creates a second Post, never re-applies internal links). Calling it again after `FAILED` resumes the **same** job (same Job ID), incrementing `retryCount` — a manual retry only, never automatic, triggered either from the wizard's "Retry" button or from the Job Queue list.

**Known boundary**: the Internal Links stage does its string-replace-based link insertion, saves it, and marks the job complete in that order. If a crash happens in the narrow window after the save but before the job is marked complete, a retry would re-run link insertion against already-linked content. This is a theoretical edge case (no I/O happens in that window), not something a transient provider API failure can trigger — those always fail before any write.

## Cost tracking

Every `AiJob` also records `inputTokens`/`outputTokens`/`totalTokens` and an estimated `costUsd`, both visible per-job in the Job Log/Job Queue and aggregated at `/admin/ai-pipeline/costs` (daily cost, monthly cost, cost by model, cost by content type).

- **Tokens** come straight from each provider's own response (`usage.input_tokens`/`output_tokens` for Anthropic, `usage.prompt_tokens`/`completion_tokens` for OpenAI, `usageMetadata.promptTokenCount`/`candidatesTokenCount` for Gemini) — never estimated. A JSON-repair retry inside `callAiForJson` (see "Provider abstraction") is a second real, billed call, so its tokens are summed into the one job's total, not dropped.
- **Cost is only ever as accurate as `lib/content-pipeline/pricing.ts`**, a small `provider:model -> $/1M tokens` table with **placeholder rates that were not verified against a live pricing page** — update it against each provider's current pricing before trusting the dollar figures for real budgeting. A model not in that table gets `costUsd: null`, never a silently wrong number, and the dashboard calls out exactly how many completed/failed jobs that affects rather than quietly excluding them.
- A job that **fails** can still have recorded cost: if the provider actually responded (e.g. `callAiForJson` ultimately gave up because the reply still wasn't valid JSON after one repair), the tokens it cost are saved on the `FAILED` job. A job that fails before any provider response (bad API key, network error) has none — correctly, since nothing was billed.

## Prompt Library (`/admin/ai-pipeline/prompts`)

Every prompt-driven stage's instructional text is editable and versioned, gated behind `SETTINGS_MANAGEMENT` (Admin/Super Admin only — this changes what's sent to a paid external API and affects published content, so it sits with the other system-configuration tools, not general content permissions).

- **Categories**: Blog, Case Study, Service, Landing Page, SEO, Social, Image, Refresh. Only **Blog, Case Study, and SEO** (`lib/content-pipeline/prompt-constants.ts`'s `WIRED_CATEGORIES`) are read by a live pipeline stage today — the other five have no generation feature yet (Service/Landing Page aren't part of the content pipeline at all; Social/Image/Refresh don't exist as stages). Their templates can still be authored and versioned now, ready for whenever those features ship — the list page marks each one "Live in pipeline" or "No stage yet" accordingly.
- **Safety boundary**: an admin's edit can only ever change the instructional/style text. The dynamic context (brief, outline, keyword, candidate links, etc.) is always code-generated before it, and the stage's required JSON output shape is always code-generated after it — neither is exposed to editing, so no prompt edit can break the parser that reads the model's reply.
- **Placeholders**: a small `{{var}}` substitution (`fillTemplate()`) — `{{topic}}`, `{{title}}`, `{{keyword}}`, `{{goal}}`, `{{audience}}`, `{{tone}}` for Blog/Case Study; `{{title}}`, `{{keyword}}` for SEO. An unmatched placeholder is left as literal text rather than erroring.
- **Versioning**: every save creates a new, immutable `PromptTemplateVersion` and immediately activates it (editing and publishing are the same action — there's no separate draft state for a prompt). **Rollback** is exactly "activate an older version" — nothing is ever deleted, so any version is always one click away.
- **Fallback**: a category with no `PromptTemplate` row yet (fresh install, or one of the five unwired categories) makes `resolvePrompt()` return `null`, and the matching stage in `prompts.ts` falls back to its own hardcoded default — identical behavior to before this feature existed. Those hardcoded defaults are also what pre-fills the "create first version" form, so the first edit starts from working text.

## Brand Knowledge Base (`/admin/brand-kb`)

Separate from the Prompt Library — this holds facts about the brand itself (voice, audience, services, products, USPs, terminology, forbidden terms, CTA rules, examples, guidelines), not per-task instructions. Same versioned/active-version/rollback shape as the Prompt Library (`BrandKnowledgeSection`/`BrandKnowledgeVersion`, gated behind `SETTINGS_MANAGEMENT`), but injected differently:

- `lib/brand-kb/context.ts`'s `buildBrandContextBlock()` is appended to **every** pipeline stage's system prompt — not just the Prompt Library's three wired categories — since brand voice/audience/forbidden terms apply to Research, Outline, Internal Links, Schema, and QA just as much as to the Draft itself. A Prompt Library category's `systemPrompt` override can still change the persona/instruction text, but can never drop the brand context block.
- **Forbidden Terms gets a real check, not just a model instruction**: the QA stage's objective checks (computed in code, same as meta-length/keyword-presence) now also scan the final content for any term listed in the Forbidden Terms section (one per line) and fails that check if found — advisory like every other QA check, shown to the human approver, never auto-blocking.
- **Fallback**: before anything is authored, `buildBrandContextBlock()` returns the same brand grounding ("TBJ Growth, a growth-marketing agency... UK businesses") that used to be hardcoded directly in `prompts.ts` — this feature is additive, nothing changes in what the model receives until an admin edits a section.

## Retrieval (RAG)

`lib/rag/retrieve.ts`'s `retrieveApprovedSources(query)` runs inside the **Research** stage, pulling the most relevant **approved** material across Pages, Services, Case Studies, FAQs, Brand Knowledge Base docs, and approved/published Posts — never a `DRAFT`/`REVIEW`/`CHANGES_REQUESTED` row, so a factual claim grounded in retrieval was always sourced from something a reviewer already signed off on. The results are stored on `Research.retrievedSources` and used twice: once by Research's own synthesis prompt, and again by the Draft stage (same object, no second retrieval call) so the actual writing — not just the research summary — is grounded in them.

**This is lexical (keyword-overlap) relevance, not vector/semantic search.** There's no embeddings provider or vector store in this project; `scoreCandidate()` just counts query-term occurrences (title weighted 3x over body) and takes the top matches. This is the same tradeoff `lib/content-search.ts` already made for this site's content volume — good enough to surface genuinely relevant material without adding a new AI-provider call type and a pgvector migration, not a claim of true semantic retrieval. Revisit if content volume or retrieval quality ever demands it.

When nothing relevant is found for a brief (score 0 across every source), the model is told exactly that and instructed not to invent facts about the business — an empty retrieval result is itself a signal, never silently dropped.

## If something goes wrong mid-run

- A stage failed — its error and retry count show in the wizard; click "Retry" (or retry from `/admin/ai-pipeline/jobs`) once the underlying problem (API key, DataForSEO credentials, transient API error) is fixed.
- A run has no `contentId` yet (failed before/at Draft) — safe to delete from the list; nothing else references it.
- A run already has `contentId` — delete the Post/CaseStudy itself from its own admin list if the whole thing needs to be scrapped; the pipeline run row is just bookkeeping at that point.
