# AI Content Pipeline

`/admin/ai-pipeline` — Brief → Search Intent → Research → Outline → Draft → Image → SEO → Internal Links → Schema → QA → Human Approval → Publish, for Blog Posts and Case Studies.

## Setup

Set in the environment (see `.env.example`):

- `AI_PROVIDER` — `anthropic` (default) | `openai` | `gemini`. Picks which provider every text stage actually calls; see "Provider abstraction" below.
- `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`, `OPENAI_API_KEY` / `OPENAI_MODEL`, `GEMINI_API_KEY` / `GEMINI_MODEL` — only the pair matching the active `AI_PROVIDER` needs to be set. Without it, every AI-driven stage fails with "`<KEY>` is not configured" and the run just sits at its current stage (nothing is lost — re-run the stage once the key is set).
- `AI_IMAGE_PROVIDER` — `openai` (default) | `gemini`, with `OPENAI_IMAGE_MODEL` / `GEMINI_IMAGE_MODEL`. **Separate from `AI_PROVIDER`** — Anthropic has no image-generation API at all, so the Image stage always needs one of the other two configured regardless of which text provider is active.
- `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` — already required for Keyword Tracking; also used here for real search-volume (Search Intent) and SERP competitor snippets (Research). If missing, those two stages still run — the model falls back to reasoning without live data instead of failing the stage.

## Provider abstraction

`lib/content-pipeline/providers/` isolates everything provider-specific behind one interface (`AiProvider`: a name, a model, and a single `complete(system, userPrompt, maxTokens)` method). `lib/content-pipeline/ai.ts`'s `callAiForJson()` — the only AI-calling function `stages.ts`/`prompts.ts` ever uses — asks `getActiveProvider()` for whichever provider `AI_PROVIDER` currently selects and calls that one method. No stage, prompt, or business logic references Anthropic, OpenAI, or Gemini by name anywhere outside `providers/`.

Switching provider or model is purely a config change: set `AI_PROVIDER` (and that provider's API key/model env vars) and the next stage run picks it up — no code changes. Adding a fourth provider means writing one new file (`providers/<name>.ts`, implementing `AiProvider`) and registering it in `providers/index.ts`'s `PROVIDER_FACTORIES` map; `stages.ts` never changes.

Each `AiJob` row (see below) records the actual `provider`/`model` that ran it at the time, read fresh on every attempt — so a run started on Claude and retried after switching `AI_PROVIDER` to GPT shows exactly that in its Job Log, rather than silently misattributing which model produced what.

## How a run works

- `ContentPipelineRun` (Prisma) tracks one run. Its `stage` field is the last stage completed; the wizard always offers to generate whichever stage comes next.
- Nothing is written to the real CMS tables until the **Draft** stage, which calls the existing `createPost`/`createCaseStudy` actions — same authorship, versioning, and audit-log behavior as a hand-written draft. `ContentPipelineRun.contentId` then points at that row.
- From Draft onward, every later stage (Image, SEO, Internal Links, Schema) reads and writes the real Post/CaseStudy row directly — there is exactly one copy of the content, not a pipeline-side draft that gets copied over later.
- **Internal Links** never lets the model rewrite HTML or apply anything itself — see its own section below.
- **QA is the Quality Gate** — see its own section below.
- **Human Approval is mandatory** and requires `APPROVE` permission specifically, not just `EDIT` — the same reviewer-tier permission the main editorial workflow requires, so whoever ran the pipeline can never also be the one who approves it for publish (a Contributor has CREATE/EDIT but not APPROVE). It's a plain manual gate (no AI call) and does not itself grant publish rights. **Publish** still goes through the same `transitionContent`/`scheduleContentJob` the rest of the CMS uses, so someone without PUBLISH permission can only "Submit for review" from here, same as anywhere else.

## Permissions

Creating a brief and advancing stages requires `CREATE`/`EDIT` (same tier as writing content normally). Actually publishing still requires `PUBLISH` (or `SCHEDULE`) — a Contributor can run the whole pipeline up to Human Approval and then only "Submit for review."

## Job tracking (`AiJob`)

Every AI-calling stage (Search Intent, Research, Outline, Draft, Image, SEO, Internal Links, Schema, QA) is wrapped in a tracked `AiJob` row — Job ID, Content ID (once known), Provider, Model, Status (`QUEUED`/`PROCESSING`/`COMPLETED`/`FAILED`), Error, Retry count, and timing (`queuedAt`/`startedAt`/`completedAt`). View them per-run in the wizard's "Job Log" panel, or all at once at `/admin/ai-pipeline/jobs`.

**Idempotency** is the actual point, not just bookkeeping: `idempotencyKey` is `"<pipelineRunId>:<stage>"`, so there is at most one job per stage per run. Calling a stage's action again after it already `COMPLETED` is a safe no-op — it returns the existing run without re-calling the AI provider or redoing any side effect (never creates a second Post). Calling it again after `FAILED` resumes the **same** job (same Job ID), incrementing `retryCount` — a manual retry only, never automatic, triggered either from the wizard's "Retry" button or from the Job Queue list.

**Image and Internal Links are the two deliberate exceptions**: both support "Regenerate" (a human asking for a genuinely fresh attempt before approving anything), so both use `createImageJob`/`createTextJob` instead — a fresh Job ID every call, never short-circuited on a prior completed one.

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

## Image + Alt Text (the Image stage)

Sits between Draft and SEO: Generate → Store → Optimize → Generate alt text → Human review → Attach.

- **Generate**: `AI_IMAGE_PROVIDER` generates the image from a prompt built from the brief/outline plus the Prompt Library's `IMAGE` category (style/subject guidance — same admin-editable pattern as Blog/Case Study/SEO).
- **Store + Optimize are the same step, not two**: the image is uploaded through the exact Cloudinary path every other image in this app uses, which already serves `f_auto`/`q_auto` (automatic format/quality) at render time via `lib/cloudinary-url.ts`. There's nothing extra to "optimize" — storing it the normal way already gets that for free.
- **Generate alt text** is a separate AI call (the active **text** `AI_PROVIDER`, not the image provider) with its own job/cost tracking, so a failure here doesn't throw away the image that was already successfully generated and stored (and already cost real money) — it falls back to the outline's title as a plain, always-present default instead of failing the whole stage.
- **Human review**: the wizard shows the image and an editable alt-text field. Editing requires saving before "Approve & Attach" is enabled, so the approved record always matches what's actually on screen.
- **Attach**: writes `featuredImage`/`featuredImageAlt` onto the real content row. Approving and attaching are the same action — there's no "approved but not yet attached" state.
- **Regenerate** is intentionally NOT idempotent like every other stage — it's an explicit "try again" a human can click as many times as they want before approving, so each click does real work and gets its own Job ID rather than short-circuiting on a prior completed attempt (see `createImageJob`'s comment in `lib/content-pipeline/jobs.ts`). A rejected attempt's image stays in the Media Library (folder "AI Generated") rather than being deleted.
- **Skip** is always available before approval — not every piece of content needs one, and skipping just advances past the stage leaving `featuredImage` untouched.
- **Cost**: image models are priced per-image, not per-token (`lib/content-pipeline/pricing.ts`'s separate `estimateImageCostUsd`), with the same placeholder-rate caveat as the token pricing table — verify before trusting the dollar figures.

## Internal Linking (the Internal Links stage)

The AI only ever *suggests* — it never touches the content directly. Each suggestion carries **Source** (this run's own content — constant across every suggestion, since this only proposes outbound links FROM the new draft; it never edits already-published content to add inbound links back to it, which would be a materially bigger, riskier feature), **Target**, **Anchor**, and the AI's own stated **Reason**.

- A suggestion that fails validation (anchor text not found verbatim in the content, or an invented/duplicate target URL) is marked `invalid` automatically and shown read-only — an editor never has to reject something that was never actually usable.
- Every other suggestion starts `pending` and the editor must explicitly **Approve** or **Reject** each one — "Apply Links" stays disabled until none are left pending. Rejecting every suggestion is a valid way to proceed with no links added.
- **Apply Links** is the one step that actually inserts anchors into the content (same exact-substring string-replace + re-sanitize as before) and advances the stage — only for suggestions marked `approved`.
- **Regenerate suggestions** discards the current batch (whatever decisions were made on it) and asks for a fresh one — same non-idempotent "always real work" exception as the Image stage's Regenerate.

## Quality Gate (the QA stage)

Ten named categories checked before mandatory human approval — six computed deterministically in code (`lib/content-pipeline/quality-gate.ts`), four that genuinely need judgment (one AI call):

| Category | How it's checked |
|---|---|
| Duplicate Content | Code — word-overlap (Jaccard) similarity against every other approved/published Post and CaseStudy; fails above 50% overlap with any one of them. Lexical, not semantic (no embeddings/vector store in this project) and only checks against this site's own content, not the open web. |
| Brand Voice | AI — judged against the Brand Knowledge Base context already in the system prompt (see "Brand Knowledge Base" above). |
| SEO | Code — meta title/description length, focus keyword in content/meta title/a heading. |
| Search Intent | AI — does the content actually answer the target keyword's intent and the Research stage's reader questions? |
| Facts | AI — are claims about our own services/results consistent with the RAG-retrieved approved sources (see "Retrieval (RAG)" above), with nothing invented? |
| Links | Code — re-verifies every link the Internal Links stage applied is still actually present in the final content (catches one stripped by a later edit); external links are counted but not live-checked here — that's what the separate Link Monitor (`/admin/link-monitor`) is for. |
| Schema | Code — structurally valid JSON-LD with the required fields (`@context`, `@type`, `headline`, `datePublished`, `mainEntityOfPage`), not just "present." |
| Metadata | Code — focus keyword, OG title/description, Twitter title/description are all set. |
| Alt Text | Code — if a featured image is set, it must have real alt text (not empty, not the AI-generated placeholder). Passes automatically if no featured image was ever generated/attached (the Image stage is skippable). |
| Quality | Code (word count ≥ 600) + AI (placeholder/lorem-ipsum text, repetition, tone inconsistency, delivers on its title). |

Every check is **advisory, not a hard gate** — a failed check is surfaced to the human approver with its note, never blocks anything automatically. The actual gate is the mandatory Human Approval step itself (see above), which exists regardless of what the Quality Gate found.

## Content Refresh Engine (`/admin/content-refresh`)

A separate flow from the main pipeline above — it operates on already-**published** content instead of creating new content, and lives in `lib/content-refresh/` rather than `lib/content-pipeline/` (it reuses the pipeline's AI/job/pricing/prompt-library plumbing, not its stage state machine). It exists to find content that's gone stale and propose a fix — it **never overwrites a live Post/CaseStudy directly**; every revision is staged on its own `ContentRefresh` row until a human approves and applies it.

**Detection** (`lib/content-refresh/detect.ts`, `scanForRefreshCandidates`) checks every published Post/CaseStudy for five signals:

| Signal | How it's detected |
|---|---|
| Old content | `publishedAt`/`updatedAt` older than 180 days. |
| Outdated content | A 4-digit year appears in the body with no more recent year anywhere else in it — a rough but cheap "this reads like it's talking about last year" heuristic, not a real fact-check. |
| Ranking decline | The two most recent `RankCheck` rows (Rank Tracker) for any `TrackedKeyword` whose `targetUrl` matches this content's own path show a ≥5-position drop, or the page fell out of tracked results entirely. |
| Traffic decline | `fetchPageTrafficTrend` (GA4, per-page) — recent 30-day sessions down ≥30% from the prior 30 days, with a minimum-volume floor so a near-zero-traffic page doesn't trigger on noise. |
| CTR decline | `fetchPageSearchTrend` (Search Console, per-page) — recent CTR down ≥30% from the prior window, same minimum-volume floor (on clicks). |

Running the scan (the admin "Scan Now" button, or the weekly `content-refresh-scan` cron job — see `.github/workflows/app-cron.yml`) upserts one `ContentRefresh` row per flagged item: a row already active (`DETECTED`/`DRAFTING`/`DRAFTED`/`APPROVED`) for that content gets its signals refreshed in place; otherwise a new `DETECTED` row is created. A row that reached `APPLIED` or `REJECTED` is left alone — if the content is flagged again later, that's a genuinely new cycle.

**Lifecycle** (`lib/content-refresh/refresh.ts`), one `ContentRefresh` row per cycle:

1. `DETECTED` — flagged, no draft yet.
2. **Generate Draft** — an AI call (Prompt Library's `REFRESH` category) given the live content, the detected signals, and RAG-retrieved approved sources, asked to revise only what the signals justify. Result is staged on the row itself (`draftTitle`/`draftContent`/`draftExcerpt`/`draftMetaTitle`/`draftMetaDescription`/`changeSummary`) → `DRAFTED`. Tracked as its own `AiJob` (`createRefreshJob` — always a fresh job, same non-idempotent "Regenerate must do real work" reasoning as the main pipeline's Image/Internal Links stages).
3. **Approve** (requires `APPROVE`) → `APPROVED`, or **Reject** (requires `EDIT`) → `REJECTED` (can draft again from there).
4. **Apply to Live Content** (requires `PUBLISH` — the strictest tier, since this is the *only* step that ever touches the real row) → goes through the normal `updatePost`/`updateCaseStudy` actions, so the pre-refresh content is automatically preserved in that content's own version history (`recordVersion`) and can be restored from there like any other edit → `APPLIED`.

Permissions are deliberately tiered differently from the main pipeline: viewing/drafting only needs `EDIT` (this is editing existing content, not creating new content), approval needs `APPROVE`, and applying needs `PUBLISH`.

## Content Recommendations (`/admin/content-recommendations`)

Finds topics worth writing that don't exist yet — the opposite direction from the Content Refresh Engine above (which fixes what's already published). Lives in `lib/content-recommendations/`, is entirely deterministic (no AI call — see "Why no AI here" below), and never creates anything itself; a recommendation only becomes real content if a human clicks through to the main pipeline's Brief form and submits it.

**Keyword-gap detection** (`lib/content-recommendations/detect.ts`, `scanForRecommendationCandidates`) combines two sources:

| Source | How a gap is found |
|---|---|
| Search Console queries | `fetchTopSearchQueries` (90-day window, site-wide) — queries with ≥10 impressions and an average position worse than 10 (not already on page 1), that don't word-overlap (`jaccardSimilarity`, same primitive `quality-gate.ts` uses for duplicate-content detection, just with a lower 0.3 bar since titles/queries are short) with any existing Post/CaseStudy title or focus keyword. Real demand, nothing dedicated written for it. |
| Tracked keywords | Rank Tracker (`TrackedKeyword`) rows with no `targetUrl`, or a `targetUrl` that no longer resolves to a real Post/CaseStudy — something the team explicitly cares about but never actually built. Sized with `fetchSearchVolume` (DataForSEO) when available; a flat default score otherwise, clearly labelled as such in the reasoning text. |

**Scoring and the four outputs** (`lib/content-recommendations/recommend.ts`, `runRecommendationScan`), all computed, never fabricated:

- **Suggested keyword** — the gap itself (the GSC query or tracked-keyword term).
- **Suggested format** — a deterministic regex classifier over the keyword (`how to`/`guide` → How-To Guide, `vs`/`compare` → Comparison, `best`/`top` → Listicle, `what is`/`define` → Explainer, `case study`/`results` → Case Study, else → Standard Post). Also decides `contentType` (`POST` or `CASE_STUDY`, same convention as `ContentPipelineRun.contentType` — `PAGE`/`SERVICE` aren't handed off anywhere, so they're never suggested).
- **Topic suggestions** — a working title built from the format + keyword (e.g. "How to ..." / "...: A Practical Shortlist" / "...: Which Is Right for You?").
- **Content priority** — every candidate's raw score (GSC: impressions, boosted 1.5× if its position is 11-20 — "strike distance," a smaller lift than starting from nothing; tracked keywords: search volume or the flat default) is ranked against every other candidate found in *that* scan and split into even thirds — top third `HIGH`, middle `MEDIUM`, bottom `LOW`. Relative, not an absolute threshold, so it stays meaningful regardless of this site's actual traffic scale.
- **Suggested publish timing** — spaced out from today using the site's *own* recent publish cadence (average days between `publishedAt` dates on PUBLISHED Posts/CaseStudies in the last 180 days, clamped to 7-30 days, falling back to a flat 14 days with too little history), one slot per candidate in priority order. Not a seasonality/trends prediction — there's no Trends API integrated here — just an honest pacing suggestion: tackle the highest-priority gap first, then the next slot after that.

**Why no AI here:** every other "reasoning" step in this system (Content Refresh's draft, the main pipeline's Research/Draft) earns its AI call by producing actual prose a human will read. A recommendation is just a ranked pointer at a gap — deterministic code can compute that correctly, for free, and re-run it any time without burning a token. The AI only gets involved once a recommendation becomes an actual Brief and goes through the real pipeline.

Running the scan (the admin "Scan Now" button, or the weekly `content-recommendations-scan` cron job — see `.github/workflows/app-cron.yml`) upserts by keyword: a row already `IN_PROGRESS` or `DISMISSED` is left completely untouched; everything else gets its score/priority/schedule refreshed. **Create Content** marks the row `IN_PROGRESS` (so a rescan doesn't keep re-suggesting it) and sends the admin to `/admin/ai-pipeline/new` with the topic/content type pre-filled on the Brief form — goal/audience/tone are still typed by hand, same as starting a brief from scratch. **Dismiss** sets `DISMISSED` and the row drops off the list for good (barring a manual DB edit).

## Content Cannibalization (`/admin/content-cannibalization`)

Finds pairs of already-published pages that are competing for the same search intent, so one isn't quietly undercutting the other. Lives in `lib/content-cannibalization/`, deterministic like Content Recommendations above (same "why no AI" reasoning — this only ever points at a pair of pages, it never rewrites anything). **The system never merges, redirects, retargets, or edits any content itself** — every suggested action is something a human does by hand elsewhere in the admin (the Posts/CaseStudies editors, the Redirects manager), and a pair's status only changes when that human clicks Resolve or Dismiss.

**Detection** (`lib/content-cannibalization/detect.ts`, `scanForCannibalizationPairs`) combines two signals across every pair of published Post/CaseStudy:

| Signal | How it's detected |
|---|---|
| Similar keywords / overlapping pages | Pairwise `jaccardSimilarity` (the same word-overlap primitive `quality-gate.ts` uses for duplicate-content detection, reused here directly) over each page's title + focus keyword + body. ≥30% overlap counts as "similar"; ≥50% is treated as near-duplicate. |
| Similar search intent | `fetchQueryPageOverlap` (Search Console, `dimensions: ["query","page"]`, 90-day window) — if two different internal pages both receive impressions for the *same* query, Google is already splitting that query's authority between them. This is the stronger, more direct signal of the two: it's Google's own behavior, not a text heuristic. |

A pair only needs to clear one of these bars to be flagged — the two signals are independent evidence of the same underlying problem, not a combined score.

**Suggested action** is a deterministic decision tree, not a judgment call an AI is asked to make:

1. **Near-duplicate content (≥50% similarity):** if one page's recent combined GA4 sessions + Search Console clicks (`fetchPageTrafficTrend`/`fetchPageSearchTrend`, reused from the Content Refresh Engine) is under 30% of the pair's total → **Redirect** (one page is already carrying almost everything; 301 the other). Otherwise → **Merge** (both still carry real traffic; consolidate into one stronger page). If GA4/GSC aren't connected, this defaults to Merge rather than guessing which page is disposable without data.
2. **Lower similarity, but strong Search Console evidence** (2+ shared queries, or one shared query with ≥50 combined impressions): → **Retarget** — the content itself isn't very alike, so this is probably just both pages' focus keyword/metadata pointing at the same term; re-point one of them rather than rewriting either.
3. **Everything else that still cleared the 30% similarity bar:** → **Differentiate** — rewrite each page to cover a distinct angle before it becomes a real problem.

Running the scan (admin "Scan Now", or the weekly `content-cannibalization-scan` cron job) upserts by the pair's two content IDs (stored in a canonical sort order so a rescan never creates the mirror image of an existing row); a pair already `RESOLVED` or `DISMISSED` is left completely alone. **Mark Resolved** is an honor-system flag — it doesn't verify anything happened, because the system has no way to know what a human did manually in the Posts/CaseStudies/Redirects admin; it just stops a handled pair from being re-flagged. **Dismiss** is for a false positive (two pages that genuinely should both exist as-is).

## Content Health Score (`/admin/content-health`)

A single 0-100 score per published Post/CaseStudy, combining the eight factors from the brief: Freshness, Traffic, Ranking, CTR, Internal Links, SEO Completeness, Search Intent, and Conversion. Unlike every other feature in this document, it's a **snapshot, not a lifecycle** — there's no detect → draft → approve → apply chain, just a number and its breakdown (`lib/content-health/`), recomputed in place on every scan (`ContentHealthScore` is upserted by content, never left in some stale "actioned" state to preserve).

**How each factor is actually scored** (`lib/content-health/score.ts`):

| Factor | How it's scored |
|---|---|
| Freshness | 100 if updated within 90 days, decaying linearly to 0 at ~18 months (540 days). |
| Traffic | `fetchPageTrafficTrend` (GA4, reused from Content Refresh) — this page's last-30-days sessions as a **percentile rank** against every other scored page in the same run, not an absolute threshold, so it stays meaningful regardless of this site's traffic scale. |
| Ranking | Best position across every `TrackedKeyword` whose `targetUrl` matches this page (Rank Tracker) — 100 at #1, losing 3 points per position below that, floored at 0. No tracked keyword for this page → no score (not a 0). |
| CTR | `fetchPageSearchTrend` (Search Console) — percentile rank of this page's CTR, same reasoning as Traffic. |
| Internal Links | A fresh inbound-link count built the same way `lib/link-monitor.ts` builds its own internal-link graph (regex over every published Post/Page/CaseStudy/Service's content) — percentile rank of how many other pages link to this one. |
| SEO Completeness | How many of 7 fields are actually filled in (meta title, meta description, focus keyword, OG title/description, Twitter title/description) — a plain pass-count, no AI judgment. |
| Search Intent | Deterministic, not AI: does the page's own focus keyword actually appear in its title, an early heading, and the body? Score is how many of those 3 are true. No focus keyword set → no score. |
| Conversion | `fetchPageConversions` (GA4's standard "conversions"/key-events metric, new this feature) — this page's conversion rate (conversions ÷ sessions) as a percentile rank against every other scored page. If GA4 has no key events configured, this legitimately comes back 0 everywhere — real data, not a bug. |

**The overall score is an average of only the factors that had real data for that page** — a page with no tracked keyword and no focus keyword isn't punished for two unmeasurable factors; its score is the average of whichever of the other 6 actually applied. The breakdown (score + a plain-language detail per factor, including which ones were skipped and why) is stored alongside the number so the admin page never needs to recompute or re-fetch GA4/GSC just to show it — expand any row to see all 8.

Grade bands: 80+ Excellent, 60-79 Good, 40-59 Needs Attention, below 40 Poor. The list is sorted worst-first by default, so the pages most worth attention surface immediately. Running the scan (admin "Scan Now", or the weekly `content-health-scan` cron job) always overwrites — there's no status to accidentally clobber.

## If something goes wrong mid-run

- A stage failed — its error and retry count show in the wizard; click "Retry" (or retry from `/admin/ai-pipeline/jobs`) once the underlying problem (API key, DataForSEO credentials, transient API error) is fixed.
- A run has no `contentId` yet (failed before/at Draft) — safe to delete from the list; nothing else references it.
- A run already has `contentId` — delete the Post/CaseStudy itself from its own admin list if the whole thing needs to be scrapped; the pipeline run row is just bookkeeping at that point.
