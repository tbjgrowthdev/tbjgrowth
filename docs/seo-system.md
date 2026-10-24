# SEO System

This is the largest feature surface in the codebase: a set of mostly-independent
tools that detect, measure, generate, or validate SEO problems/opportunities
across Posts, Pages, Case Studies, Services, and Locations. Most of it follows
one of two shapes:

- **Deterministic scan → persisted row → human decides** (no AI, re-run safely,
  already-actioned rows left alone on rescan) — content quality/decay tooling,
  technical SEO tooling, programmatic SEO guardrails.
- **Computed live on every page view, nothing persisted** — Internal Link
  Graph, Topic Clusters, SEO Change Log/Impact. These three have no backing
  Prisma model at all; they're derived at request time from content already in
  the DB (and, for Change Log, from `AuditLog`).

A few tools make a real, billed AI call (SEO Performance Feedback's diagnosis);
the rest are explicitly AI-free by design — see each section's "why no AI"
note where one exists.

## Table of contents

1. [Programmatic & structured SEO](#programmatic--structured-seo)
   - [Internal Link Graph](#internal-link-graph)
   - [Topic Clusters](#topic-clusters)
   - [Local SEO (Locations)](#local-seo-locations)
   - [Programmatic SEO (pSEO)](#programmatic-seo-pseo)
2. [Content quality & decay](#content-quality--decay)
   - [Content Health Score](#content-health-score)
   - [Content Refresh Engine](#content-refresh-engine)
   - [Content Recommendations](#content-recommendations)
   - [Content Cannibalization](#content-cannibalization)
   - [Orphan Page Detection](#orphan-page-detection)
3. [Technical SEO tooling](#technical-seo-tooling)
   - [Automated SEO Audits](#automated-seo-audits)
   - [Canonical / Hreflang validation](#canonical--hreflang-validation)
   - [Redirect analysis](#redirect-analysis)
   - [Link Monitor](#link-monitor)
   - [Keyword mapping conflicts](#keyword-mapping-conflicts)
4. [Measurement & experimentation](#measurement--experimentation)
   - [GSC / GA4 import](#gsc--ga4-import)
   - [SEO Change Log & Change Impact](#seo-change-log--change-impact)
   - [SEO Experimentation](#seo-experimentation)
   - [SEO Performance Feedback](#seo-performance-feedback)
   - [Executive Analytics](#executive-analytics)
5. [Shared primitives](#shared-primitives)
6. [Open questions / things to verify](#open-questions--things-to-verify)

---

## Programmatic & structured SEO

### Internal Link Graph

`/admin/link-graph` — `lib/link-graph/build.ts`'s `buildInternalLinkGraph()`,
called directly by `app/(admin)/actions/link-graph.ts` on every page view.
**No Prisma model, no scan, no staleness** — it's rebuilt fresh each time from
the real rendered content.

- Reads every published Post/Page/CaseStudy and indexable Service's HTML body
  (same content universe `lib/link-monitor.ts` checks for broken links),
  regexes out every `<a href="/...">` tag, and builds a node per distinct
  internal path + an edge per source→target pair, with anchor text and counts.
- A target path that isn't a real content record (e.g. `/contact`, the
  homepage) still gets a node, typed `OTHER`, so the graph accounts for every
  internal link on the site, not just editorial-to-editorial ones.
- Self-links are excluded. Edges are sorted by link count descending.

Because this is the *actual* link graph (parsed straight from rendered HTML),
it's the ground truth both Topic Clusters and the SEO Audits' "Orphan Pages"
check build on top of, rather than a second, possibly-divergent model of
"intended" link structure.

### Topic Clusters

`/admin/topic-clusters` — `lib/topic-clusters/build.ts`'s `buildTopicClusters()`,
same "computed live, no model" shape as the Link Graph above.

- Groups published/indexable Posts/Pages/CaseStudies/Services into clusters by
  word-overlap similarity (Jaccard, threshold `0.3` — the same bar
  Cannibalization and Orphan Pages use for "related enough to flag"), via a
  union-find over every pair. Groups of 1 are dropped (not a cluster).
- Within each group, roles are assigned from signals already on the content
  and the real Internal Link Graph above it — not a separate "intended
  structure" model:
  - **Pillar**: the group's most substantial page (highest word count, ties
    broken by inbound links from its own cluster peers).
  - **Cluster**: other members that already link to the pillar in the live
    graph.
  - **Supporting**: members on the same topic that *don't* yet link to the
    pillar — the gap this feature exists to surface (it never auto-adds the
    link; a human does that in the content editor).

This is an O(n²) pairwise comparison, explicitly accepted at this site's
content volume (same tradeoff Cannibalization/Orphan Pages make).

### Local SEO (Locations)

`/admin/locations`, public at `/[locale]/locations` and
`/[locale]/locations/[slug]` — `lib/locations.ts`, `Location`/`LocationFaq`
Prisma models (`prisma/schema.prisma:977`).

- A `Location` is a real NAP (Name/Address/Phone) record — address fields are
  kept as separate schema.org `PostalAddress` components (street, locality,
  region, postal code, ISO-3166-1 country) rather than one free-text blob, so
  `lib/schema.ts`'s `locationLocalBusinessSchema()` can emit real structured
  `LocalBusiness` JSON-LD instead of guessing how to split a string.
- `market` (`"uk" | "bangladesh" | "gulf"`) gates which locale(s) a location's
  sitemap entry and page are valid under — a Dhaka office has no `en-GB`/
  `ar-AE` URL, enforced both by `app/(public)/[locale]/locations/[slug]/page.tsx`
  (404s outside its market) and `lib/sitemap.ts`'s `getLocationEntries()`
  (Locations aren't a `TranslatableKind`, so there's no hreflang alternate set
  to build for them).
- Carries the full SEO field set (meta title/description, focus keyword,
  canonical, OG/Twitter, schema override) for parity with `AgencyService`'s
  `SeoPanel`, plus its own `LocationFaq` list (same replace-all-FAQs pattern as
  `ServiceFaq` — see `app/(admin)/actions/locationFaqs.ts`, and
  [Known Limitations](known-limitations.md) for why that's `deleteMany` +
  `Promise.all` of individual `create()`s rather than one transaction).
- `Executive Analytics` (below) separately rolls Location pages' GSC/GA4 rows
  up by `market`.

### Programmatic SEO (pSEO)

`/admin/programmatic-seo`, public at `/[locale]/pSEO/[slug]` —
`lib/programmatic-seo/`, models `PSeoTemplate` → `PSeoDataset` (one CSV
upload) → `PSeoDatasetRow` → `PSeoPage` (`prisma/schema.prisma:1053`).

- A **Template** defines `{{column}}`-placeholder title/meta/H1/body text
  (`lib/programmatic-seo/render.ts`'s `renderTemplate`/`renderSlug`), a
  required-columns list, a minimum word count, and a duplicate-similarity
  threshold.
- A **Dataset** is one CSV upload against a template; each row becomes one
  `PSeoDatasetRow` (`lib/programmatic-seo/csv.ts`).
- **Generating** (`lib/programmatic-seo/generate.ts`'s
  `generatePagesForDataset`) renders every row, runs three guardrails
  (`lib/programmatic-seo/guardrails.ts`), and **upserts** one `PSeoPage` per
  row keyed by `rowId` — safe to re-run after editing the template or
  re-uploading a corrected CSV; it never creates duplicate page records.
  - `LOW_VALUE` — the row is missing a value the template marked required.
  - `THIN_CONTENT` — rendered body falls under the template's minimum word
    count.
  - `DUPLICATE` — Jaccard word-overlap against every other page already
    generated from this template exceeds the threshold (catches a template
    that doesn't vary enough between rows — the actual failure mode by which
    programmatic SEO mass-produces near-identical pages).
- **Status**: a page that fails any guardrail is still created (so there's
  something concrete to review) but forced to `NEEDS_REVIEW` (noindex) rather
  than silently skipped or silently published. A human can override to
  `OVERRIDDEN` (publish anyway) — that decision survives a later regeneration;
  only the rendered content re-renders on a rescan, not the override status.
- Row values from the CSV are always HTML-escaped on render; only the
  template string itself (admin-authored, same trust level as
  `AgencyService.content`) is allowed to carry real HTML.
- `PSeoTemplate.isIndexable` is a template-level master switch — off takes
  every one of that template's pages out of the index regardless of per-page
  guardrail status. `lib/sitemap.ts`'s `getPSeoEntries()` only lists pages that
  are `PUBLISHED`/`OVERRIDDEN` **and** whose template is indexable.

---

## Content quality & decay

All five of these live under their own `lib/<feature>/` folder, run via an
admin "Scan Now" button or a weekly cron (`.github/workflows/app-cron.yml`),
and share the "already-actioned rows are left alone on rescan" convention —
none of them silently overwrite a human decision.

### Content Health Score

`/admin/content-health` — `lib/content-health/score.ts`. The one exception to
the lifecycle shape below: it's a **snapshot, not a lifecycle** (no
detect→draft→approve→apply chain), just a 0-100 number + breakdown, recomputed
in place on every scan (`ContentHealthScore` upserted by content).

Eight factors, each scored independently and **only averaged over the factors
that had real data for that page** (e.g. no tracked keyword → Ranking is
skipped, not scored 0):

| Factor | How it's scored |
|---|---|
| Freshness | 100 if updated within 90 days, linear decay to 0 at ~540 days |
| Traffic | GA4 sessions, percentile rank vs. every other scored page this run |
| Ranking | Best Rank Tracker position for this page, 100 at #1, −3/position |
| CTR | Search Console CTR, percentile rank vs. other scored pages |
| Internal Links | Inbound link count (same regex graph as Link Monitor), percentile rank |
| SEO Completeness | Plain pass-count over 7 fields (meta title/desc, focus keyword, OG/Twitter) |
| Search Intent | Deterministic: focus keyword present in title / an early heading / body |
| Conversion | GA4 conversions ÷ sessions, percentile rank |

Grade bands: 80+ Excellent, 60-79 Good, 40-59 Needs Attention, <40 Poor. Weekly
cron: `content-health-scan` (Mondays).

### Content Refresh Engine

`/admin/content-refresh` — `lib/content-refresh/`. Operates on already-
**published** content; **never overwrites a live Post/CaseStudy directly** —
every revision is staged on its own `ContentRefresh` row until approved.

- **Detection** (`detect.ts`): old content (>180 days), outdated mentions (a
  stale year with no newer year anywhere in the body), ranking decline (≥5
  position drop or fell out of tracked results), traffic decline (GA4 sessions
  down ≥30%), CTR decline (Search Console CTR down ≥30%).
- **Lifecycle**: `DETECTED` → **Generate Draft** (one real AI call via the
  content pipeline's provider abstraction, grounded in RAG-retrieved approved
  sources — see `docs/runbooks/ai-content-pipeline.md`) → `DRAFTED` →
  **Approve** (`APPROVE` permission) or **Reject** → `APPROVED` → **Apply to
  Live Content** (`PUBLISH` permission — the only step that touches the real
  row; goes through the normal `updatePost`/`updateCaseStudy` actions, so
  the pre-refresh content is preserved in that content's own version history)
  → `APPLIED`.
- Weekly cron: `content-refresh-scan` (Mondays). Feeds **SEO Performance
  Feedback** below (its decline/decay signals are reused there verbatim).

### Content Recommendations

`/admin/content-recommendations` — `lib/content-recommendations/`. The
opposite direction from Content Refresh: finds topics worth writing that
*don't exist yet*. **Entirely deterministic, no AI call** — see "why no AI"
below.

- **Keyword-gap detection** (`detect.ts`) combines Search Console queries
  (≥10 impressions, position worse than 10, no existing content with
  word-overlapping title/keyword) with orphaned Rank Tracker keywords (tracked
  but no `targetUrl`, or a dead one).
- **Scoring** (`recommend.ts`): suggested keyword, suggested format (regex
  classifier — "how to"→How-To, "vs"→Comparison, etc.), a working title,
  priority (ranked against other candidates *in that scan* and split into
  thirds — relative, not an absolute threshold), and suggested publish timing
  (paced from the site's own recent publish cadence, clamped 7-30 days).
- **Why no AI here**: a recommendation is just a ranked pointer at a gap —
  deterministic code computes that correctly, for free, re-runnable any time
  without burning a token. AI only gets involved once a recommendation becomes
  an actual Brief and goes through the real pipeline (**Create Content**
  pre-fills the pipeline's Brief form and marks the row `IN_PROGRESS`).
- Weekly cron: `content-recommendations-scan` (Mondays).

### Content Cannibalization

`/admin/content-cannibalization` — `lib/content-cannibalization/`. Finds
pairs of published pages competing for the same intent. **Never merges,
redirects, retargets, or edits anything itself** — every suggested action is
done by hand elsewhere (Posts/CaseStudies editors, Redirects manager); a
pair's status only changes when a human clicks Resolve or Dismiss.

- **Detection** (`detect.ts`): pairwise Jaccard similarity (≥30% "similar",
  ≥50% "near-duplicate") **or** Search Console query/page overlap (two
  different pages both getting impressions for the same query — Google's own
  behavior, the stronger signal of the two). Either signal alone is enough to
  flag a pair.
- **Suggested action** is a deterministic decision tree, not an AI judgment
  call: near-duplicate + one page carrying <30% of combined traffic →
  **Redirect**; near-duplicate + both carrying real traffic → **Merge**;
  lower similarity but strong query overlap → **Retarget**; everything else
  that cleared the bar → **Differentiate**.
- Weekly cron: `content-cannibalization-scan` (Mondays). Feeds **SEO
  Performance Feedback** (flagged pairs become a `CANNIBALIZATION` signal on
  both sides).

### Orphan Page Detection

`/admin/orphan-pages` — `lib/orphan-pages/detect.ts`'s
`detectOrphanAndWeakPages()`, persisted via `lib/orphan-pages/orphan-pages.ts`'s
`runOrphanPageScan()` into the `OrphanPage` model.

- Scope is deliberately just Posts/CaseStudies (Pages/Services are reached via
  navigation, not cross-content links — "orphan" doesn't mean the same thing
  for them, and their body content isn't editorial prose suited to contextual
  linking as a *source* either).
- A page with 0 inbound internal links is `orphan`; exactly 1 is `weak`
  (fragile — a single source page); 2+ is healthy, never flagged.
- For each flagged page, suggests up to 3 similar-topic pages to link **from**
  (same Jaccard similarity, ≥0.3), each with an anchor lifted from the
  target's own focus keyword/title and a verbatim sentence from the source
  page as a "here's roughly where this would fit" pointer — never a
  fabricated sentence.
- **Route exists but has no cron wired up**: `app/api/cron/orphan-pages-scan`
  checks `CRON_SECRET` like every other cron route, but no GitHub Actions
  workflow (`.github/workflows/app-cron.yml` or any other) currently calls it
  on a schedule — confirmed by grepping every workflow file. Today it only
  runs from the admin "Scan Now" button, or a manual authenticated curl. If
  this needs to run on autopilot, it needs a new schedule entry added to
  `app-cron.yml`.

---

## Technical SEO tooling

### Automated SEO Audits

`/admin/seo-audits` — `lib/seo-audits/run.ts`'s `runSeoAudit()`, persisted to
`SeoAuditRun` (one row per run, findings as a JSON blob).

14 fixed categories (`lib/seo-audits/types.ts`'s `SEO_AUDIT_CATEGORIES`), 8
computed fresh every run (`lib/seo-audits/checks.ts`: Missing/Duplicate
Title, Missing/Duplicate Meta, Missing/Multiple H1, Noindex Issues, Thin
Content (<300 words), Missing Alt, Schema Problems, Orphan Pages — this is a
*separate*, simpler orphan check than the dedicated Orphan Page Detection
feature above: flags Post/CaseStudy pages with literally zero inbound
content-body links, no link suggestions attached), and 3 that deliberately
**reuse** already-built scans rather than re-crawling the site a second time
in the same run: Canonical Errors (`lib/canonical-hreflang.ts`), Redirect
Problems (`lib/redirect-analysis.ts`), and Broken Links (the latest nightly
`lib/link-monitor.ts` run).

A run with findings sends a notification (`lib/email.ts`'s
`sendSeoAuditNotification`). **Also has no cron wired up** — same gap as
Orphan Page Detection: `app/api/cron/seo-audit-scan` exists and checks
`CRON_SECRET`, but isn't in `app-cron.yml` or any other workflow. Manual-only
today.

### Canonical / Hreflang validation

`/admin/canonical-hreflang` — `lib/canonical-hreflang.ts`. Deterministic, no
AI (same "why no AI" reasoning as Recommendations/Cannibalization/Health
Score — these are structural/URL checks, not judgment calls).

Three checks `lib/translation.ts`'s own per-item `buildHreflangAlternates`
can't catch on its own (it only ever sees one content item at a time):
malformed canonical overrides (not a real absolute URL), duplicate canonical
targets (two+ distinct items whose *effective* canonical resolves to the same
URL — advisory, sometimes intentional ahead of a redirect), and non-reciprocal
hreflang (a cross-domain canonical override on content that still has
published translations — flagged as a real problem, since "canonical points
elsewhere" and "here are language alternates for this page" directly
contradict each other).

### Redirect analysis

`/admin/redirects` — `lib/redirect-analysis.ts`'s `analyzeRedirects()`. Walks
every `Redirect` row's source→destination chain (max 20 hops) looking for
**chains** (A→B→C — should be collapsed to a single hop), **loops** (chain
revisits a path it already followed), and **duplicates**. Feeds into the SEO
Audits' "Redirect Problems" category.

### Link Monitor

`/admin/link-monitor` — `lib/link-monitor.ts`. Nightly cron (`link-check`,
03:00 UTC) crawls every published Post/Page/CaseStudy/indexable Service's body
for internal 404s and external broken links, plus reuses
`lib/redirect-analysis.ts` for redirect chain/loop findings, persisted to
`LinkCheckRun`. `getAllContent()` here is the shared "every published page's
raw content" source several other features (`content-health`,
`seo-audits`) reuse rather than re-querying. Sends a notification via
`lib/email.ts` when findings exist. Feeds the SEO Audits' "Broken Links"
category (reads the *latest* run rather than re-crawling).

### Keyword mapping conflicts

`/admin/keywords` — `lib/keyword-mapping.ts`. `TrackedKeyword` rows are
unique on `[term, targetUrl]`, so the same term can legitimately point at
multiple URLs (e.g. an informational guide and a separate commercial landing
page). What this flags is the actual problem: two or more **different** URLs
targeting the same term **and** the same search intent — nothing distinguishes
which page should rank, so Google is left to pick. Deterministic, no fuzzy
matching — exactly the data already entered.

---

## Measurement & experimentation

### GSC / GA4 import

`/admin/gsc-import`, `/admin/ga4-import` — `lib/gsc-import.ts`,
`lib/ga4-import.ts`. Pulls Search Console / GA4 rows for a date range and
**upserts** them into `SearchConsoleMetric` / `AnalyticsLandingPageMetric`
(not skip-duplicates — GSC's most recent 1-3 days are provisional and can
change on a later pull, so re-importing a range should always reflect the
latest numbers). Every row is resolved to a `contentType`/`contentId` via
`lib/content-url-mapping.ts` (`parseUrlPath` + `classifyPath` — listing pages
and the homepage are deliberately left unmapped rather than guessed at).

This is the data every other feature in this section reads: SEO
Experimentation's before/after, Change Impact, the Content Refresh/Health/
Recommendations/Cannibalization signals that use traffic/ranking/CTR, and
Executive Analytics. Chunked in batches of 200 rows, each chunk written via
`Promise.all` of independent `upsert()` calls (idempotent and independently
keyed, so concurrent + retry-safe) rather than a transaction — see
[Known Limitations](known-limitations.md) for why.

### SEO Change Log & Change Impact

`/admin/seo-change-log` — `lib/seo-change-log/`. **No dedicated model, no
write path of its own** — it's a read-time diff over `AuditLog` rows that
every content update action already writes (`before`/`after` JSON snapshots).
`getSeoChangeLog()` flattens matching audit rows into one entry per
(row, changed SEO field) pair, for a fixed, ordered list of 19 SEO fields
(`lib/seo-change-log/types.ts`'s `SEO_CHANGE_FIELDS` — title, slug, meta
title/description, focus keyword, canonical, schema override, OG/Twitter
fields, robots directives). Scans up to the 500 most recent matching
`AuditLog` rows before filtering/paginating.

**Change Impact** (`impact.ts`'s `computeChangeImpact()`) compares a
`windowDays` (default 28) baseline immediately before a given change against
the same window after it, using whatever GSC/GA4 data has been imported —
the exact same `aggregateMetrics`/`computeDeltas` primitives SEO
Experimentation uses below, just anchored to an organic edit (from the Change
Log) instead of an explicit launch. Nothing is persisted; it's recomputed on
demand each time it's viewed, since the change itself is already durable as
the `AuditLog` row it's anchored to.

### SEO Experimentation

`/admin/seo-experiments` — `lib/seo-experiments/`, `SeoExperiment` model.
**Sequential before/after testing on the real content record — not a live
visitor-bucketed split test.** This site has no traffic-splitting
infrastructure, and serving two versions of a page simultaneously risks a
cloaking penalty, so the design is deliberate: launching an experiment
snapshots the current field value, writes the new one to the actual content
record (one version live at a time, same as any manual edit), then compares.

- **Variables**: `TITLE`/`META_DESCRIPTION` target the matching SEO field
  directly; `CTA`/`INTERNAL_LINKS`/`CONTENT_SECTION` all really mean "a change
  somewhere in the body" (`content` field) — the variable name is how the
  admin labels *why* they're testing, not a distinct storage mechanism.
- **Lifecycle**: `DRAFT` → **Launch** (writes `afterValue` to the live
  content, status → `RUNNING`, starts the clock) → **Evaluate** (safe to call
  anytime for a live preview; only flips to `COMPLETED` once the evaluation
  window has actually fully elapsed) or **Revert** (writes `beforeValue` back,
  status → `REVERTED` — a human deciding the test isn't worth running out).
- **Metrics** (`metrics.ts`): sums GSC + GA4 rows already imported for that
  content over the window; CTR and position are recomputed from summed
  totals (impression-weighted), never averaged day-by-day, so a few
  high-volume days aren't diluted by a long tail of near-zero ones.
  Percentage deltas return `null` (not "∞% up") when the baseline was 0.
- `contentType` here is a plain string, not the Prisma `ContentType` enum
  (which has no `SERVICE` value) — Location is deliberately excluded, having
  no rich body for CTA/Internal Links/Content Section to target.

### SEO Performance Feedback

`/admin/seo-performance-feedback` — `lib/seo-performance-feedback/`,
`PerformanceFeedback` model. **Merges two already-independent detectors** —
Content Refresh's decline/decay scan and Content Cannibalization's pairwise
scan — into one signal list per piece of content, then makes **one real,
billed AI call per flagged item** to turn the raw signals into a plain-English
diagnosis + 3-5 recommendations (prompt explicitly forbids inventing numbers
or causes beyond what was detected).

- **Severity** (`deriveSeverity()`) is a weighted sum: revenue-adjacent
  signals (Conversion decline, Ranking decline, Cannibalization) weigh 3×,
  Traffic decline 2×, CTR decline/Content Decay 1× — ≥5 is `HIGH`, ≥2
  `MEDIUM`, else `LOW`.
- Signals/severity are persisted **before** the AI call and kept even if that
  call fails (the row needs a real id to attach a job to, and the detected
  signals are already real, useful data on their own).
- Tracked via `AiJob` like every other AI call in this codebase — this is the
  call site behind `AiJob.performanceFeedbackId` (added in the
  `20261021142709_sync_schema_drift` migration — see
  [Known Limitations](known-limitations.md) and
  [Troubleshooting](troubleshooting.md) for the schema-drift incident that
  surfaced it).
- A newly-appeared signal type (one this content didn't have on its prior
  scan) fires an Automation Engine event (`fireAutomationEvent`) — see
  [Integration Setup](integration-setup.md) for what the Automation Engine
  does with that.
- A row already `DISMISSED` is left untouched on rescan.

### Executive Analytics

`/admin/executive-analytics` — `lib/executive-analytics/aggregate.ts`'s
`getExecutiveAnalytics()`. **A pure rollup — no new writes, no new models.**
Reads tables every other feature above already populates
(`SearchConsoleMetric`/`AnalyticsLandingPageMetric`, `ContentHealthScore`,
`SeoAuditRun`, `AiJob`, `ContentRefresh`, `Location`) plus
`getCostSummary()` (AI spend, from the content pipeline), and reshapes them
into: organic traffic trend, leads (form submissions + confirmed bookings),
conversion rate, top pages/keywords, content performance by health grade, SEO
health (latest audit run), AI usage/cost, production volume (published counts
by type + completed pipeline runs), refresh opportunities by status, and
market performance (Location pages' GSC/GA4 rolled up by `Location.market`).

Gated behind `SETTINGS_MANAGEMENT` (Admin/Super Admin only) — a business-wide
rollup, not a single team's working tool, same permission tier as
Settings/Monitoring/Brand KB.

---

## Shared primitives

A handful of small building blocks are reused across most of the features
above rather than reimplemented per feature — worth knowing once rather than
re-deriving per section:

- **`jaccardSimilarity`/`tokenize`** (`lib/content-pipeline/quality-gate.ts`) —
  word-overlap similarity. Used by Topic Clusters, Content Cannibalization,
  Orphan Page Detection, Programmatic SEO's duplicate guardrail, and the
  content pipeline's own duplicate-content QA check. **Lexical, not semantic**
  — there's no embeddings provider or vector store anywhere in this project;
  every one of these features explicitly accepts that tradeoff at this site's
  content volume rather than adding a pgvector migration.
- **`lib/content-url-mapping.ts`** — resolves a GSC/GA4 URL/path to a
  `contentType`/`contentId`. Everything that joins search/analytics data back
  to a CMS record goes through this.
- **"Why no AI here"** — stated explicitly in Content Recommendations,
  Cannibalization, Health Score, and Canonical/Hreflang: these are ranking,
  grouping, or structural-validity problems deterministic code already solves
  correctly and for free; AI is reserved for features that produce prose a
  human will read (Content Refresh's draft, Performance Feedback's diagnosis,
  the main content pipeline).
- **"Already-actioned rows are left alone on rescan"** — Orphan Pages,
  Content Refresh, Recommendations, Cannibalization, Performance Feedback,
  and pSEO's `OVERRIDDEN` status all honor this. A rescan refreshes open/new
  items; it never reverts a human's Dismiss/Resolve/Override.
- **Thresholds throughout this document (0.3 similarity, 300-word thin
  content, 180-day staleness, ±30% decline bars, etc.) are explicitly called
  out in their own source files as starting points, not values tuned against
  real outcomes** — worth revisiting with real data rather than assumed correct.

## Open questions / things to verify

- `app/api/cron/orphan-pages-scan` and `app/api/cron/seo-audit-scan` are not
  wired into any GitHub Actions workflow — confirmed by checking every file in
  `.github/workflows/`. Both run today only via the admin "Scan Now" button or
  a manual authenticated request. Flagging rather than assuming this is
  intentional — it may simply not have been wired up yet.
- The SEO Audits' own "Orphan Pages" check and the dedicated Orphan Page
  Detection feature overlap in intent but are genuinely separate code paths
  with different scope/output (the audit just flags zero-inbound-link pages
  with no suggestions; the dedicated feature also flags "weak" pages and
  generates link suggestions). Not a bug — just worth knowing they're not the
  same thing if a count looks inconsistent between the two admin pages.
- Programmatic SEO's public render path (`app/(public)/[locale]/pSEO/[slug]`)
  exists and the sitemap lists it, but this doc did not trace that route's
  full rendering logic — only confirmed it exists and that the sitemap's URL
  shape (`/pSEO/<slug>`) matches it.
