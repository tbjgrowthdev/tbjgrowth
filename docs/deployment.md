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

### Runtime constraints this choice imposes

Several architectural decisions elsewhere in this codebase exist *because* the target is a Cloudflare Worker, not a long-lived Node server:
- The Neon **HTTP** adapter instead of the WebSocket one (`lib/prisma.ts`) — Workers forbid reusing an I/O object like an open WebSocket across requests. See `docs/architecture.md` and `docs/known-limitations.md`.
- No in-app rate limiter — Cloudflare already sits in front of every request; rate limiting belongs at the zone/WAF layer (`docs/runbooks/security.md`).
- Backups and uptime checks run in GitHub Actions, not inside the Worker — a Worker can't shell out to `pg_dump` or hold a long-lived raw TCP connection open, and a probe running *inside* the thing being probed can't detect the Worker itself being unreachable. See `docs/backup-process.md` / `docs/monitoring.md`.
- `next.config.ts` sets `serverExternalPackages: ["pg", "pg-cloudflare"]` and `experimental.cpus: 1`.

### Environment variables for the deployed Worker

Set directly in **Cloudflare dashboard → Workers & Pages → the Worker → Settings → Variables and Secrets** — never in `wrangler.jsonc`, never in Cloudflare's "Build variables" (build-time-only, invisible at runtime; this exact distinction caused a `NEXTAUTH_SECRET` incident previously). Full variable list: `docs/environment-variables.md`.

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
```

The GitHub Actions workflows that call these need matching secrets configured in **Settings → Secrets and variables → Actions** — see `docs/backup-process.md` for the full secret list (`PRODUCTION_URL`, `CRON_SECRET`, `DATABASE_URL_DIRECT`, R2 credentials, Neon API credentials). Run each workflow once manually (Actions tab → the workflow → **Run workflow**) after adding secrets, before trusting the schedule.

**Open question not resolved by reading the repo alone**: whether Cloudflare Cron Triggers are *also* independently configured for any of these routes outside of what's version-controlled here (Cloudflare Cron Triggers for a Worker are set via `wrangler.jsonc`'s `triggers.crons` or the dashboard — this repo's current `wrangler.jsonc` has no `triggers` block, so if any Cloudflare-side cron exists for this Worker, it was set directly in the dashboard and isn't visible from the repo). Check the Cloudflare dashboard → the Worker → **Triggers** tab to confirm there's no second, undocumented schedule double-firing one of these routes.

## CI

`.github/workflows/`: `app-cron.yml` (scheduled scans), `db-backup.yml` (nightly backup + verify), `uptime-check.yml` (external uptime probe). No separate build/test/deploy-on-push CI workflow was found in this directory — deploys are run manually via `npm run deploy`, not automatically on merge to `main`. Confirm this is still the intended process; if automatic deploy-on-push is wanted, it isn't wired up yet.
