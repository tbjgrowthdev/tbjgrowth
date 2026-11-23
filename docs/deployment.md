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

### `20261119000000_add_push_devices` (TBJ Admin app push notifications)

Additive: new enum `PushEvent` and tables `PushDevice` and `PushPreference`. **Run `npx prisma migrate deploy` before deploying the mobile-app branch.** If the code ships first, the contact form, bookings and approvals still work (push sending catches its own errors), but the Profile page's Notifications card and device registration fail until the tables exist.

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
app/api/cron/client-reminders
```

The GitHub Actions workflows that call these need matching secrets configured in **Settings → Secrets and variables → Actions** — see `docs/backup-process.md` for the full secret list (`PRODUCTION_URL`, `CRON_SECRET`, `DATABASE_URL_DIRECT`, R2 credentials, Neon API credentials). Run each workflow once manually (Actions tab → the workflow → **Run workflow**) after adding secrets, before trusting the schedule.

**Open question not resolved by reading the repo alone**: whether Cloudflare Cron Triggers are *also* independently configured for any of these routes outside of what's version-controlled here (Cloudflare Cron Triggers for a Worker are set via `wrangler.jsonc`'s `triggers.crons` or the dashboard — this repo's current `wrangler.jsonc` has no `triggers` block, so if any Cloudflare-side cron exists for this Worker, it was set directly in the dashboard and isn't visible from the repo). Check the Cloudflare dashboard → the Worker → **Triggers** tab to confirm there's no second, undocumented schedule double-firing one of these routes.

## CI

`.github/workflows/`: `checks.yml` (below), `app-cron.yml` (scheduled scans and cleanup), `db-backup.yml` (nightly backup + verify), `uptime-check.yml` (external uptime probe).

**Pushing to `main` auto-deploys to Cloudflare** (Workers Builds). `checks.yml` runs on every pull request and every push to `main`:

1. `pnpm install --frozen-lockfile` (pnpm 11, Node 22 latest — the test runner needs Node 22.18+, newer than `.node-version`'s 22.14.0).
2. `prisma generate` (placeholder `DIRECT_URL`; it never connects) and `next typegen` — both outputs are gitignored and `tsc` needs them.
3. Server-action auth check, **lint of the changed JS/TS files only**, `tsc --noEmit`, `pnpm test`, `next build`. Each runs even if an earlier one failed.

- **Lint scope:** the codebase still has ~290 lint errors, so CI lints only files the PR/push adds or modifies. A touched file must be fully clean, pre-existing errors included. Switch the step to `pnpm run lint` once the backlog is gone.
- **The build has no database, on purpose.** Nothing may query the database at build time: admin pages are `force-dynamic` (`app/(admin)/layout.tsx`) and landing pages render and cache at runtime (`app/landing-pages/layout.tsx`). A CI build failing with `NeonDbError` means a page started prerendering with live data.
- **These checks don't block a deploy by themselves:** Cloudflare deploys whatever reaches `main`. To make them a gate, protect `main` in GitHub (Settings → Branches): require a pull request and the `checks` status check.

## Client Hub rollout (client portal + TBJ Growth Tech app 1.1.0)

The Client Hub is the client portal at `/portal`, run from the new **Clients** section in `/admin`, and the TBJ Growth Tech Android app now opens it (1.1.0). Do these **in this order**. Steps 1–4 are needed before the first deploy of this code; the deploy fails without step 2 and every portal page fails without step 3.

1. **Database.** Back up first (Neon → Branches → create a branch from production, or the daily backup in `docs/backup-process.md`). Then check what is pending and apply it:
   ```bash
   npx prisma migrate status     # check the host it prints is the database you mean
   npx prisma migrate deploy
   ```
   Client Hub migrations, all additive and nullable, safe to apply before the code:
   - `20261122000000_add_client_hub`: **already applied to production on 2026-11-22.** `migrate status` should list it as applied.
   - `20261123000000_client_hub_notify_throttle`: `Project.lastClientNotifyAt` (one push per project per hour for milestone updates).
   - `20261124000000_client_hub_meeting_reminders`: `Booking.reminder24hSentAt`, `Booking.reminder1hSentAt`.

   `prisma.config.ts` reads `DIRECT_URL` from `.env`, which is production. For a throwaway local check, set `DIRECT_URL` (not only `DATABASE_URL`) to the local URL, or use a separate config file, and confirm the host `migrate status` prints before running anything.
2. **Private R2 bucket** for client files (see "Client Hub files" below): `npx wrangler r2 bucket create tbj-client-files`. Leave public access off and connect no domain.
3. **Worker secret `CLIENT_SESSION_SECRET`**: random, 32+ bytes (`openssl rand -base64 48`), set with `npx wrangler secret put CLIENT_SESSION_SECRET` or in the Cloudflare dashboard as a *Secret*. Never reuse `NEXTAUTH_SECRET`. Changing it later signs every client out. See `docs/environment-variables.md`.
4. **Deploy** as usual. Build from WSL, macOS/Linux or CI (`npm run build:cloudflare` doesn't run on Windows with pnpm, see above). Check that the GitHub Actions secrets `PRODUCTION_URL` and `CRON_SECRET` exist; the new `client-reminders` job in `.github/workflows/app-cron.yml` runs every 15 minutes (meeting reminders, overdue invoices, stale-project nudges). Run the workflow once by hand (Actions → App cron → Run workflow) and check the `client-reminders` job is green.
5. **Create a test client** in `/admin/clients`: a client, then a user with an email you can read. The invite email arrives with a code. Sign in at `/portal/login` in a browser first.
6. **Release the client app** (`mobile/README.md` has the build steps; 1.1.0, versionCode 2, same package ID and signing key, so it installs over 1.0.0):
   ```bash
   npx wrangler r2 object put tbj-downloads/tbj-growth-tech.apk --remote --file client/release/app-client-release.apk \
     --content-type application/vnd.android.package-archive
   ```
   Then set the build variable `NEXT_PUBLIC_ANDROID_APP_VERSION` to `1.1.0` and redeploy, so `/app` shows the new version.
7. **Pilot on real phones**: the checklist in `mobile/README.md` ("Client Hub pilot"). Only then invite real clients.

## Client Hub files (private R2 bucket)

Reports, invoices and update attachments for the client portal live in the private R2 bucket `tbj-client-files`, bound as `CLIENT_FILES` in `wrangler.jsonc`. **Create it before deploying the Client Hub code; the deploy fails without it:**

```bash
npx wrangler r2 bucket create tbj-client-files    # private: leave public access OFF, no custom domain
```

Never turn on public access or connect a domain. Files are only served by `/api/portal/files/[id]` (the signed-in client, own files only) and `/api/admin/client-files/[id]` (staff with `CLIENT_MANAGEMENT`), both with `Cache-Control: private, no-store`. Keys are `clients/{clientId}/{uuid}`; uploads are PDF, PNG or JPG up to 10 MB (`lib/portal/upload-limits.ts`; it fits under the 10 MB Server Action body limit in `next.config.ts`), checked by their first bytes.

## Android apps (TBJ Admin + TBJ Growth Tech)

The Capacitor project is in `mobile/`. Build steps, the signing key and versioning are in `mobile/README.md`. This section covers the one-time cloud setup and releasing an APK.

**Before the first deploy of the mobile-app branch, do these in this order:**
1. Run the migration `20261119000000_add_push_devices` (above).
2. Create the private R2 bucket `tbj-app-builds` (step 2 below). **The deploy fails without it**, because `wrangler.jsonc` binds it.
3. Set the Worker secret `FCM_SERVICE_ACCOUNT_JSON` (step 1 below). This one is optional: until it's set, push is simply off.

### 1. Firebase setup (push notifications)

1. In the [Firebase console](https://console.firebase.google.com), create a project, e.g. "TBJ Growth Tech". Analytics is not needed.
2. **Add two Android apps** to that one project:
   - `com.tbjgrowthtech.admin` (nickname "TBJ Admin")
   - `com.tbjgrowthtech.app` (nickname "TBJ Growth Tech")

   For both, add the release key's SHA-1 and SHA-256 from `mobile/README.md`.
3. Download `google-services.json` after adding the second app, so it lists both. Put it at `mobile/android/app/google-services.json`. It is gitignored: keep a copy with the keystore backup.
4. Go to Project settings → Service accounts → **Generate new private key**. A JSON file downloads.
5. Store that JSON as the Worker **secret** `FCM_SERVICE_ACCOUNT_JSON`, as one line. Either:
   - `npx wrangler secret put FCM_SERVICE_ACCOUNT_JSON` (paste the file contents), or
   - Cloudflare dashboard → Workers & Pages → `tbjgrowth` → Settings → Variables and Secrets → Add → type *Secret*.

   For local testing, put it in `.env.local` too. Never commit it.
6. Rebuild both APKs (`mobile/README.md`); they pick up `google-services.json` automatically.

Both apps register for push, each for its own users: TBJ Admin for staff, the TBJ Growth Tech app (Client Hub, from 1.1.0) for the signed-in client user. A device is never registered for both (`lib/native.ts` `pushTargetFor`, and the `PushDevice_one_owner` CHECK).

### 2. Hosting the APKs on R2 (two files)

| File | Bucket | Access | Linked from |
|---|---|---|---|
| `tbj-admin.apk` | `tbj-app-builds` | **private**: no public access, no custom domain. The Worker reads it through the `APP_BUILDS` binding (`wrangler.jsonc`). | `/admin/app`, via `/api/admin/app-download` (signed-in only) |
| `tbj-growth-tech.apk` | `tbj-downloads` | public, on the custom domain `downloads.tbjgrowthtech.com` | `/app` and the footer's "Get the App" |

One-time:

```bash
npx wrangler r2 bucket create tbj-app-builds     # private: leave public access OFF
npx wrangler r2 bucket create tbj-downloads
```

Then in Cloudflare → R2 → `tbj-downloads` → Settings → Custom Domains → connect `downloads.tbjgrowthtech.com`.

Each release (after building as in `mobile/README.md`):

```bash
cd mobile/android/app/build/outputs/apk
npx wrangler r2 object put tbj-app-builds/tbj-admin.apk --remote --file admin/release/app-admin-release.apk \
  --content-type application/vnd.android.package-archive --custom-metadata version=1.0.0
npx wrangler r2 object put tbj-downloads/tbj-growth-tech.apk --remote --file client/release/app-client-release.apk \
  --content-type application/vnd.android.package-archive
```

- `/admin/app` reads the version from the object's `version` metadata.
- For `/app`, set the Cloudflare **build** variable `NEXT_PUBLIC_ANDROID_APP_VERSION` and redeploy (it is inlined at build time).
- Phones that already have an app update by downloading the new APK and tapping Install. It must be the same package and the same key.

### 3. Check on a real phone after each release

- **TBJ Admin:**
  1. Sign in on the website from the phone and open `/admin/app`. Download, install (allow "from this source" once) and open it.
  2. Sign in with your password and 2FA. Allow notifications.
  3. From another device, send the contact form. A "New lead received" notification arrives with no client details, and tapping it opens `/admin/leads`.
  4. Log out in the app, then send the form again. No notification arrives.
- **TBJ Growth Tech:**
  1. Install it from `/app`. It installs alongside TBJ Admin.
  2. Browsing works, including `/bn-bd` and `/ar-ae` (right-to-left), and booking a call works.
  3. It never asks for notification permission.
- **Cloudflare build watch paths:** exclude `mobile/**` and `docs/**` so app-only commits don't redeploy the site. This is under Workers & Pages → `tbjgrowth` → Settings → Builds.
