# Deployment Process

## Live target: Cloudflare Workers (via OpenNext) — not Vercel

There are two deployment configs present in the repo (`wrangler.jsonc` + `open-next.config.ts` for Cloudflare, and a `vercel.json` for Vercel), which looks ambiguous at a glance. It isn't: **Cloudflare is live, `vercel.json` is dead config left over from before the app moved off Vercel.** This is stated explicitly in `docs/runbooks/database-restore.md`: *"`.github/workflows/app-cron.yml` — replaces `vercel.json`'s cron config, which has had no effect since the app moved off Vercel."* `vercel.json` is otherwise harmless to leave in place but should not be trusted as documentation of current cron behavior — see below for what actually runs crons now.

### Build & deploy commands (`package.json`)

```jsonc
"build:cloudflare": "prisma generate && opennextjs-cloudflare build",
"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
```

`npm run deploy` is the real deploy path: OpenNext builds the Next.js app into a Cloudflare Worker bundle (`.open-next/worker.js`, per `wrangler.jsonc`'s `main`), then `wrangler` ships it. `open-next.config.ts` adds one thing on top of OpenNext's Cloudflare defaults: `buildCommand: "npx prisma generate && npx next build"` — the generated Prisma client (`lib/generated/prisma`, target `workerd`) must exist before the Next.js build runs, since it's imported directly by application code.

`wrangler.jsonc`: `compatibility_flags: ["nodejs_compat"]` (needed for `pg`/`bcryptjs`/etc.), static assets served from `.open-next/assets` via the `ASSETS` binding, `keep_vars: true` (don't let a deploy clear previously-set dashboard vars).

Plain Vercel-style commands also exist (`build`, `start`, `dev`) and still work for local development (`next dev`) — they are not how this app is deployed.

### ISR page cache (R2 + D1 + Durable Object)

Public pages under `app/(public)/[locale]` are cached (ISR). Three things have to be in place, or every page view is rendered live and queries Neon:

1. **`generateStaticParams` returning `[]`** in `app/(public)/[locale]/layout.tsx` and every `[slug]` page. Without it Next.js treats the `[locale]` segment as fully dynamic and ignores `revalidate`. Check with `next build`: public routes must show `●`, not `ƒ`.
2. **Cache overrides** in `open-next.config.ts`: R2 incremental cache (with a regional Cache API layer), D1 tag cache, Durable Object queue. OpenNext's defaults are no-op "dummy" caches.
3. **Bindings** in `wrangler.jsonc`: R2 bucket `tbj-next-cache`, D1 database `tbj-next-tag-cache` (its real `database_id` must replace the placeholder), the `DOQueueHandler` Durable Object, and the `WORKER_SELF_REFERENCE` service binding.

One-time setup, before the first deploy with this config:

```bash
npx wrangler r2 bucket create tbj-next-cache
npx wrangler d1 create tbj-next-tag-cache   # paste the printed database_id into wrangler.jsonc
```

`npm run deploy` creates the D1 `revalidations` table and the Durable Object on its own.

**Invalidation.** Admin code imports `revalidatePath` from `@/lib/revalidate`, not `next/cache`. Next.js tags cached pages by their internal route and pathname (`/(public)/[locale]/blog/page`, `/en-gb/blog`), so a plain `revalidatePath("/blog")` matches nothing. The wrapper passes `/admin/...` paths through unchanged and turns any other path into one invalidation of the whole public site (`revalidatePublicSite()`). Each page then re-renders once on its next visit. New admin actions that change anything a public page shows must call one of these two functions.

**Verify after deploying:** request a public page twice. The second response should carry `x-nextjs-cache: HIT`. Save an edit in the admin, and the next request should be a `MISS` that shows the new content.

The regional Cache API layer only works on a custom domain. On `*.workers.dev` it does nothing and every hit reads from R2 instead, which is still cached, just a little slower.

`opennextjs-cloudflare build` fails on Windows with pnpm (`Cannot read directory ".open-next/server-functions/default/node_modules/.pnpm/...": Access is denied`). This happens with or without the cache config. Build and deploy from WSL, macOS/Linux, or CI.

### Images

`/_next/image` doesn't optimize anything on this deployment. Without an `IMAGES` binding, OpenNext returns the original file at any requested width. `next.config.ts` therefore uses a custom loader (`lib/image-loader.ts`):

- **Cloudinary URLs** load directly from Cloudinary as `f_auto,q_auto,c_limit,w_<width>`. Each new image and width combination uses one Cloudinary transformation (free plan: 25 credits a month, 1 credit = 1,000 transformations or 1 GB of bandwidth). Check usage in the Cloudinary console.
- **Same-site files** (`/public`, static imports) go through **Cloudflare Image Transformations** at `/cdn-cgi/image/width=…,quality=85,format=auto/…`. This must be enabled on the `tbjgrowthtech.com` zone: **Cloudflare dashboard → Images → Transformations → Enable** for the zone. Leave "resize from any origin" off; only same-site images are transformed. Free up to 5,000 unique transformations a month (one source image at one width = one; format and quality don't count separately). After that it's $0.50 per 1,000. On the Free plan, new transformations past the limit fail rather than being billed.
- `/cdn-cgi/` only works on the zone. On `*.workers.dev`, static images 404. Under `next dev` the loader serves originals.
- Plain `<img>` tags (CMS block images, testimonial avatars) use `responsiveImgProps()` from the same file, so they're resized too.

Enable Transformations **before** deploying code that uses this loader. Otherwise every static image on the site 404s.

### Runtime constraints this choice imposes

Several architectural decisions elsewhere in this codebase exist *because* the target is a Cloudflare Worker, not a long-lived Node server:
- The Neon **HTTP** adapter instead of the WebSocket one (`lib/prisma.ts`) — Workers forbid reusing an I/O object like an open WebSocket across requests. See `docs/architecture.md` and `docs/known-limitations.md`.
- No in-app rate limiter — Cloudflare already sits in front of every request; rate limiting belongs at the zone/WAF layer (`docs/runbooks/security.md`).
- Backups and uptime checks run in GitHub Actions, not inside the Worker — a Worker can't shell out to `pg_dump` or hold a long-lived raw TCP connection open, and a probe running *inside* the thing being probed can't detect the Worker itself being unreachable. See `docs/backup-process.md` / `docs/monitoring.md`.
- `next.config.ts` sets `serverExternalPackages: ["pg", "pg-cloudflare"]` and `experimental.cpus: 1`.

### Environment variables for the deployed Worker

Set directly in **Cloudflare dashboard → Workers & Pages → the Worker → Settings → Variables and Secrets** — never in `wrangler.jsonc`, never in Cloudflare's "Build variables" (build-time-only, invisible at runtime; this exact distinction caused a `NEXTAUTH_SECRET` incident previously). Full variable list: `docs/environment-variables.md`.

## Database migrations

`npm run deploy` does **not** touch the database. Schema changes are applied separately, by hand, with `npx prisma migrate deploy` — which uses `DIRECT_URL` (Neon's unpooled endpoint) via `prisma.config.ts`, not the app's pooled `DATABASE_URL`. Apply migrations **before** deploying code that depends on them; a deploy that runs ahead of its migration crashes on the missing column/table (this happened in production on 2026-10-21 — see `docs/troubleshooting.md`).

Never run `prisma migrate dev` or `prisma db push` against production. `migrate dev` targets whatever `DIRECT_URL` points at — in this repo's `.env`, that's production.

### `20261031000000_add_ai_provider_keys` (AI provider keys in Settings)

Adds six values to the `IntegrationProvider` enum (`ANTHROPIC`, `OPENAI`, `GEMINI`, `XAI`, `OPENROUTER`, `CEREBRAS`). Additive and idempotent (`ADD VALUE IF NOT EXISTS`), no table changes. **Run `npx prisma migrate deploy` before deploying the code that adds the API keys panel.** If the code ships first nothing breaks (AI calls keep using the `*_API_KEY` env vars and Settings says keys can't be stored yet), but no key can be saved until the migration is applied. `INTEGRATION_ENCRYPTION_KEY` must be set on the Worker for keys to be saved.

### ⚠️ Staging first: `20261021000000_sync_missing_enum_values` + `20261021000001_sync_missing_models`

**These two migrations must be tested on a staging database before being applied to production.**

What they are: a baseline for the ~40 models that were originally created with `prisma db push` and never recorded in migration history. Before they existed, replaying `prisma/migrations` on an empty database failed at `sync_schema_drift` (`type "PipelineStage" does not exist`), so any fresh database — staging, a restore target, local dev — couldn't be built from migrations alone. They're dated *between* `second` and `sync_schema_drift` deliberately, because the drift migration modifies tables they create.

They're written to be safe on a database that already has these tables (every statement is `IF NOT EXISTS` or wrapped in a `DO` block that ignores "already exists"), and were rehearsed locally on 2026-10-28 against three cases: an empty database, a production-like `db push`'d database with existing rows and `second`/`sync_schema_drift` already recorded as applied, and an old database still at `second`'s state with data in `Redirect.permanent` (which is copied into `statusCode` — `true` → 301, `false` → 302 — before that column is dropped). All three ended with `migrate diff` reporting no difference and seeded data intact. A local rehearsal is not a substitute for staging: production's real data, Neon's Postgres version, and anything changed by hand in production aren't covered by it.

Known limitation: `CREATE TABLE IF NOT EXISTS` skips a table that already exists **in an older shape** rather than fixing it. That's why step 4 below matters.

**Procedure:**

1. **Make a staging copy of production.** Neon console → the project → **Branches** → **Create branch** from the production branch (copy-on-write, instant, includes current data). Copy the new branch's **direct** (unpooled) connection string.
2. **Point the Prisma CLI at the branch for this shell only** (`dotenv` never overrides a variable that's already set, so this wins over `.env`):
   - PowerShell: `$env:DIRECT_URL="<branch direct URL>"`
   - bash: `export DIRECT_URL="<branch direct URL>"`

   Then confirm the target before running anything: `npx prisma migrate status` must print the **branch's** host, and should list exactly these two migrations as not yet applied.
3. `npx prisma migrate deploy` — should apply both and finish with "All migrations have been successfully applied."
4. `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` — must print **"No difference detected."** Anything else means the branch had a table in an older shape; stop and investigate before production.
5. Point a local `next dev` (`DATABASE_URL` = the branch's pooled URL) at the branch and smoke-test the admin: log in, open a post, Redirects, Booking, AI Pipeline.
6. Only then repeat steps 2–4 against production (unset `DIRECT_URL` in the shell first so `.env`'s production value is used — and re-check `migrate status` prints the production host). Delete the Neon branch afterwards.

If you'd rather not execute any SQL on production at all: once staging has proven the SQL correct, `npx prisma migrate resolve --applied 20261021000000_sync_missing_enum_values` and `npx prisma migrate resolve --applied 20261021000001_sync_missing_models` record them as applied without running them — Prisma's standard baselining approach, appropriate because production already has everything they create. Still run step 4 against production afterwards.

**Rehearsing any migration locally** (no cloud resources): `npx prisma dev --name verify --detach` starts a disposable local Postgres. Point a throwaway Prisma config file at its `postgres://…localhost…` URL (never edit `prisma.config.ts` itself) and run `migrate deploy --config <that file>`. `npx prisma dev rm verify` removes it.

## Cron jobs

Two different scheduling mechanisms are in play — know which one actually drives which route before changing either:

### 1. Cloudflare Cron Triggers → app routes (frequent/light jobs)

`wrangler.jsonc` doesn't currently declare `[triggers]`/crons itself in this repo snapshot — the authoritative current cron wiring for these three is `.github/workflows/app-cron.yml` (see below), which replaced `vercel.json`'s old (now-inert) cron block. `vercel.json` still lists:
```json
{ "path": "/api/cron/scheduled-jobs", "schedule": "*/5 * * * *" },
{ "path": "/api/cron/link-check", "schedule": "0 3 * * *" },
{ "path": "/api/cron/seo-audit-scan", "schedule": "0 4 * * *" }
```
Treat this `vercel.json` content as **historical intent, not live config** — confirm actual current schedules in `.github/workflows/app-cron.yml` before relying on timing here.

### 2. GitHub Actions → `/api/cron/*` (the live mechanism for everything scheduled)

`.github/workflows/app-cron.yml` is what actually drives the content/SEO scan routes today (plus whatever else it's configured for — check the workflow file directly for exact schedules, since this doc intentionally doesn't duplicate cron-expression numbers that drift independently of the code). `.github/workflows/db-backup.yml` (daily, 02:00 UTC) and `.github/workflows/uptime-check.yml` (~every 5 minutes) handle backup and uptime specifically — see `docs/backup-process.md` and `docs/monitoring.md`.

Every `/api/cron/*` route is **bearer-token protected by `CRON_SECRET`**, checked independently of any user session (confirmed by grep — every route under `app/api/cron/` opens with the same `process.env.CRON_SECRET` check and refuses to run, logging an error, if it's unset):

```
app/api/cron/backup-report
app/api/cron/content-cannibalization-scan
app/api/cron/content-health-scan
app/api/cron/content-recommendations-scan
app/api/cron/content-refresh-scan
app/api/cron/link-check
app/api/cron/orphan-pages-scan
app/api/cron/scheduled-jobs
app/api/cron/seo-audit-scan
app/api/cron/uptime-report
app/api/cron/log-retention
```

The GitHub Actions workflows that call these need matching secrets configured in **Settings → Secrets and variables → Actions** — see `docs/backup-process.md` for the full secret list (`PRODUCTION_URL`, `CRON_SECRET`, `DATABASE_URL_DIRECT`, R2 credentials, Neon API credentials). Run each workflow once manually (Actions tab → the workflow → **Run workflow**) after adding secrets, before trusting the schedule.

**Open question not resolved by reading the repo alone**: whether Cloudflare Cron Triggers are *also* independently configured for any of these routes outside of what's version-controlled here (Cloudflare Cron Triggers for a Worker are set via `wrangler.jsonc`'s `triggers.crons` or the dashboard — this repo's current `wrangler.jsonc` has no `triggers` block, so if any Cloudflare-side cron exists for this Worker, it was set directly in the dashboard and isn't visible from the repo). Check the Cloudflare dashboard → the Worker → **Triggers** tab to confirm there's no second, undocumented schedule double-firing one of these routes.

## CI

`.github/workflows/`: `app-cron.yml` (scheduled scans), `db-backup.yml` (nightly backup + verify), `uptime-check.yml` (external uptime probe). No separate build/test/deploy-on-push CI workflow was found in this directory — deploys are run manually via `npm run deploy`, not automatically on merge to `main`. Confirm this is still the intended process; if automatic deploy-on-push is wanted, it isn't wired up yet.
