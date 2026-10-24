# Backup process

There is a real, app-independent backup pipeline here — it is **not** just
"Neon's own PITR is the backup." Two separate mechanisms exist and serve
different failure modes:

## Mechanism 1 — Neon's point-in-time recovery (PITR)

Neon retains WAL history on its own, for a window that depends on the Neon
plan (check Neon Console → the project → Settings → Storage). This covers
the common case — "something got corrupted/deleted an hour ago" — with no
extra infrastructure. It's not configured or triggered by this repo at
all; it's a platform feature of the Neon project itself.

## Mechanism 2 — Scheduled `pg_dump` to Cloudflare R2

This is this repo's own backup, and it exists specifically for the case
PITR can't cover: the Neon project itself being gone, or the retention
window having already passed.

`.github/workflows/db-backup.yml` runs **in GitHub Actions, not in the
Cloudflare Worker** — `pg_dump` needs a real TCP connection and a
filesystem, neither of which the Worker runtime provides (the app itself
only ever talks to Neon over HTTP, via `PrismaNeonHttp` — see
`lib/prisma.ts`). Schedule: daily at 02:00 UTC, plus manual
`workflow_dispatch`. Steps, in order:

1. **Dump and upload** (`scripts/backup/dump-and-upload.sh`) — connects
   via `DATABASE_URL_DIRECT` (Neon's unpooled endpoint — a pooled
   connection isn't appropriate for a long-running `pg_dump`), runs
   `pg_dump --format=custom`, gzips it, uploads to R2 at
   `db-backups/backup-<UTC timestamp>.dump.gz`.
2. **Rotate** (`scripts/backup/rotate.sh`) — deletes R2 objects older than
   `BACKUP_RETENTION_DAYS` (repo variable, default 14). Flat window, not
   tiered (no separate daily/weekly/monthly retention).
3. **Verify restore** (`scripts/backup/verify-restore.sh`) — actually
   restores the dump into a **throwaway Neon branch** (via the Neon API,
   `NEON_API_KEY`/`NEON_PROJECT_ID`), confirms it worked, then deletes the
   branch. This is what makes a backup trustworthy rather than merely
   present — a dump file that was never proven to restore is not a backup
   you can rely on under pressure.
4. **Report result** — POSTs to `/api/cron/backup-report` with
   `startedAt`/`completedAt`/`success`/`sizeBytes`/`objectKey`/`verified`/
   `error`, authenticated with the same `Bearer <CRON_SECRET>` pattern
   used by every other cron route in this app
   (`app/api/cron/scheduled-jobs`, `app/api/cron/link-check`).

### What the app itself does with that report

`app/api/cron/backup-report/route.ts` is **report-only** — it never
triggers a backup, it only records one that already happened in CI. It
calls `recordBackupRun()` in `lib/backup-monitor.ts`, which:

- Writes a `BackupRun` row (`startedAt`, `completedAt`, `success`,
  `sizeBytes`, `objectKey`, `verified`, `error`).
- If `!success || !verified`, emails an alert via
  `sendBackupAlertNotification` (`lib/email.ts`) to the site's configured
  notification address (`SiteSetting.email`).

`getBackupHistory()` feeds the **Admin → Monitoring → Backups** view (not
the newer Observability dashboard — see `docs/monitoring.md`) so an admin
can see the last 30 runs, their verified/unverified/failed status, and
pick a known-good one if a restore is ever needed.

## Required secrets (GitHub repo → Settings → Secrets and variables → Actions)

| Secret | Purpose |
| --- | --- |
| `PRODUCTION_URL` | where the cron/report requests go |
| `CRON_SECRET` | same value as the Worker's `CRON_SECRET` env var |
| `DATABASE_URL_DIRECT` | Neon's unpooled connection string — required for `pg_dump`/`pg_restore` |
| `R2_BUCKET`, `R2_ENDPOINT` | the R2 bucket and its S3-compatible endpoint |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | an R2 API token scoped to that bucket |
| `NEON_API_KEY`, `NEON_PROJECT_ID` | used only to create/delete the throwaway verification branch |

Optional repo variables: `BACKUP_RETENTION_DAYS` (default 14),
`MIN_CONTENT_BYTES` (used by the separate uptime-check workflow, not this
one).

Run the workflow manually once (Actions tab → **Database backup** → **Run
workflow**) after adding secrets, before trusting the nightly schedule.

## Restoring from either mechanism

See `docs/restore-process.md` and `docs/runbooks/database-restore.md` — the
actual step-by-step procedure lives there, not duplicated here.
