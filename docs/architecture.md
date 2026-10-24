# Architecture

## Stack

- **Next.js 16** (App Router), **TypeScript**, **React 19**.
- **Prisma 7** as the ORM, with a generated client at `lib/generated/prisma` (runtime target `workerd` — see `prisma/schema.prisma`'s `generator client` block).
- **Database**: Neon (serverless Postgres).
- **Auth**: NextAuth v4, Credentials provider + JWT sessions (see "Auth" below).
- **Media**: Cloudinary.
- **Email**: Resend.
- **AI providers**: Anthropic / OpenAI / Gemini, switchable via env var (see `docs/runbooks/ai-content-pipeline.md`).
- **Deployment target**: Cloudflare Workers, via OpenNext (`@opennextjs/cloudflare`) — see `docs/deployment.md`.

## Why the Neon HTTP adapter

`lib/prisma.ts` constructs the Prisma client with `PrismaNeonHttp` from `@prisma/adapter-neon`, not the WebSocket-based `PrismaNeon` adapter. This is a deliberate, load-bearing choice, not an oversight: Cloudflare Workers forbids reusing an I/O object (e.g. an open WebSocket) across different requests, even within the same long-lived isolate. The WebSocket adapter hung on every request after the first in a given isolate for exactly this reason. `PrismaNeonHttp` issues a fresh `fetch()` per query instead of holding a connection open, so there's nothing to illegally reuse.

**This has a real cost**: the adapter's `startTransaction()` always rejects with `"Transactions are not supported in HTTP mode"` — not just for interactive `$transaction(async tx => ...)` callbacks, but for the batched array form as soon as it holds more than one operation, and for Prisma's own internal `createMany`/`updateMany` (which route through the same path even as a single call). This shapes a lot of the action-layer code across the app (`app/(admin)/actions/booking.ts`, `bulk-posts.ts`, `locationFaqs.ts`, `serviceFaqs.ts`, `lib/workflow.ts`, `lib/gsc-import.ts`, `lib/ga4-import.ts`, `lib/executive-analytics/aggregate.ts` all had to work around it). See **`docs/known-limitations.md`** for the full empirically-verified breakdown of what works and what doesn't — this file just flags it as a top-level architectural fact everyone touching write-heavy code needs to know.

`prisma.config.ts` separates two datasource URLs: `DATABASE_URL` (pooled, `pgbouncer=true`, what the deployed app actually runs queries against) vs `DIRECT_URL` (Neon's unpooled endpoint, used only by the Prisma CLI for `migrate diff`/`migrate deploy`/`db execute`). Both point at the same database. See `docs/database-schema.md`.

## Folder layout

```
app/
  (admin)/          # everything behind /admin — layout, pages, Server Actions
    actions/        # "use server" files — one file per feature area, the only way the admin UI mutates data
    admin/<feature>/ # one folder per admin page/section (~45 of them)
  (public)/[locale]/ # the public, i18n-aware site (see lib/i18n.ts)
  api/
    auth/            # NextAuth route handler
    cron/            # scheduled job endpoints, bearer-protected by CRON_SECRET (see docs/deployment.md)
    google/          # Google OAuth connect/callback (Search Console + GA4)
    internal/        # internal-only endpoints (redirect map for middleware, client error reporting)
components/          # React components, grouped by area (Admin/, HomeComponents/, ui/, ...)
lib/                 # business logic — see below
prisma/              # schema.prisma + migrations/
docs/                # this documentation set + docs/runbooks/ (deep-dive runbooks for specific ops procedures)
```

`middleware.ts` (Edge runtime) does three things on every request: resolves DB-driven redirects (`lib/redirect-cache.ts`), gates `/admin/*` on a valid session + role before the page renders, and resolves the public site's locale prefix (`lib/i18n.ts`). It cannot talk to Prisma directly (no Node runtime at the Edge), which is why the redirect map is cached rather than queried live each time.

### `lib/` feature areas

Most non-trivial business logic lives in a dedicated `lib/<feature>/` subfolder rather than a flat file, each exposing a small number of entry points the admin Server Actions or cron routes call:

| Folder | What it does |
|---|---|
| `lib/content-pipeline/` | The AI Content Pipeline's stage machine, AI provider abstraction, job/cost tracking, prompt library. See `docs/runbooks/ai-content-pipeline.md` and `docs/ai-workflow.md`. |
| `lib/content-refresh/` | Detects stale/declining published content and drafts (AI) a revision, staged until human approval — never auto-applies. |
| `lib/content-recommendations/` | Deterministic keyword-gap detection (no AI) — surfaces content worth writing that doesn't exist yet. |
| `lib/content-cannibalization/` | Deterministic detection of pages competing for the same search intent; only ever suggests (Merge/Differentiate/Redirect/Retarget), never acts. |
| `lib/content-health/` | Computes a 0–100 health score per published page from 8 weighted factors (freshness, traffic, ranking, CTR, internal links, SEO completeness, search intent, conversion) — a snapshot, not a lifecycle. |
| `lib/orphan-pages/` | Finds published Posts/CaseStudies with 0–1 inbound internal links and suggests sources to link from. |
| `lib/link-graph/` | Builds the internal-link graph **on the fly** from existing content (regex over Post/Page/CaseStudy/Service bodies) — there is no `InternalLink` table; it's computed, not persisted. |
| `lib/topic-clusters/` (`build.ts`) | Same "compute on read" approach as link-graph — clusters published content by shared keywords/links, no dedicated table. |
| `lib/programmatic-seo/` | Template + CSV dataset → bulk-generated, guardrail-checked landing pages (`PSeoTemplate`/`PSeoDataset`/`PSeoPage`). |
| `lib/seo-experiments/` | Sequential before/after SEO testing on real content (not live traffic-splitting) — snapshots a field, changes it, compares GSC/GA4 metrics across a baseline/evaluation window. |
| `lib/seo-change-log/` | Surfaces every SEO-relevant field edit from `AuditLog` as a timeline, and (`impact.ts`) measures before/after performance around any such edit — same metrics primitive as `seo-experiments`, just anchored to an organic edit instead of a deliberate launch. |
| `lib/seo-performance-feedback/` | Synthesizes signals already detected elsewhere (refresh/cannibalization/decay) into one AI-written diagnosis + recommendations per page. Advisory only. |
| `lib/seo-audits/` | The 14-category Automated SEO Audit (title/meta issues, thin content, broken links, orphan pages, schema problems, etc.). |
| `lib/integrations/` | Integration Hub's credential registry/crypto/mirror for providers with no other home (Google Business Profile, Meta, CRM, Slack, WordPress, Webhooks). |
| `lib/automation/` | The Webhook & Automation Engine — event → condition → action rule execution (`engine.ts`), reusing existing primitives (SEO audit, refresh draft, Slack/webhook send, reviewer assignment) rather than reimplementing them. |
| `lib/rag/` | Lexical (keyword-overlap, **not** vector/semantic) retrieval of approved source material for the AI pipeline's Research stage. |
| `lib/brand-kb/` | Assembles the versioned Brand Knowledge Base into a context block injected into every AI pipeline stage's system prompt. |
| `lib/executive-analytics/` | Aggregates content/pipeline/SEO data for the executive dashboard. |
| `lib/observability/` | Aggregates slow queries, error logs, and email delivery logs for `/admin/observability`. |

Flat `lib/*.ts` files handle cross-cutting concerns: `auth.ts`/`auth-guard.ts`/`permissions.ts`/`totp.ts`/`session-tracking.ts` (auth — see "Auth" below and `docs/admin-roles.md`/`docs/permission-matrix.md`), `prisma.ts` (client singleton + slow-query logging), `workflow.ts` (content approval state machine — see `docs/cms-workflow.md`), `email.ts`, `sanitize.ts`, `audit-log.ts`, `versioning.ts`, `i18n.ts`/`translation.ts`, `seo-meta.ts`/`seo-fields.ts`/`seo-utils.ts`/`schema.ts`/`schema-engine.ts`, `gsc-import.ts`/`ga4-import.ts`, `redirect-analysis.ts`/`redirect-cache.ts`, `link-monitor.ts`, `scheduled-jobs.ts`/`scheduling.ts`, `error-monitor.ts`, `backup-monitor.ts`/`uptime-monitor.ts`.

## Auth, at a glance

NextAuth v4 with `CredentialsProvider` (email + bcrypt password, optional TOTP 2FA), JWT session strategy (NextAuth's "database" strategy isn't compatible with `CredentialsProvider` in v4). Because of that, this app layers its own `AdminSession` table on top of the JWT — every sign-in creates a row (ip, user-agent, timestamps); the JWT carries that row's id; `lib/auth-guard.ts`'s `requireSession()` checks `revokedAt` on it on **every** server action, which is what makes "Revoke" on a device in **Admin → My Profile → Active Sessions** take effect immediately without a session-strategy change.

Two enforcement layers, deliberately redundant:
1. `middleware.ts` blocks unauthenticated navigation to `/admin/*` before the page renders.
2. Every mutating Server Action calls `requirePermission(...)` (`lib/auth-guard.ts`) itself — a Server Action is invoked directly by id and isn't re-checked by middleware's route matching, so relying on middleware alone would leave authorization implicit rather than enforced at the point the mutation actually happens.

Roles and what each can do: see **`docs/admin-roles.md`** and **`docs/permission-matrix.md`**. 2FA/session/brute-force detail: `docs/runbooks/security.md`.

## Open questions / things this doc deliberately doesn't cover

- The exact current deploy target ambiguity (Cloudflare vs. a stale `vercel.json`) is resolved in `docs/deployment.md` — short version: Cloudflare is live, `vercel.json` is dead config left over from before the move.
- `README.md` and `walkthrough.md` at the repo root are leftover `create-next-app` boilerplate / an old session's ad-hoc notes respectively — neither reflects the current state of the app; this `docs/` set supersedes them as the source of truth going forward.
