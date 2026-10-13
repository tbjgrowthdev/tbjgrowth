# Database restore procedure

Two recovery paths exist. Use the first (Neon PITR) unless the Neon project
itself is gone or the corruption predates its retention window — it's
faster and doesn't require any manual schema/data reconciliation.

## Path 1 — Neon point-in-time restore (normal case)

Neon retains WAL history on its own (retention window depends on the Neon
plan — check **Project → Settings → Storage** for the current window). This
restores to any point within that window without needing one of the R2
backups at all.

1. Neon Console → the project → **Branches** → **Restore** (or **Create
   branch** → "From a specific time" if restoring into a new branch instead
   of restoring in place — prefer this for anything other than a confirmed
   full incident, so the current (possibly-bad) data isn't destroyed until
   the restored data has been checked).
2. Pick the timestamp just before the incident.
3. Once the restored branch looks correct (spot-check a few tables, admin
   login works, recent content is there), either:
   - Promote that branch to be the one `DATABASE_URL`/`DATABASE_URL_DIRECT`
     point at, or
   - Copy its connection string into the Worker's env vars.
4. Cloudflare dashboard → Workers & Pages → the Worker → **Settings →
   Variables and Secrets** → update `DATABASE_URL` (and
   `DATABASE_URL_DIRECT` if that's also bound there) to the restored
   branch's connection string.
5. Redeploy (or trigger a new build) so the Worker picks up the new value —
   env var changes alone don't necessarily bust a running isolate's cached
   `process.env`.
6. Verify: hit `/api/internal/env-check` and the homepage, confirm real
   content renders (not just a 200 — see the Monitoring tab's "content OK"
   check for what this project means by that).

## Path 2 — Restore from an R2 backup (Neon project itself is unusable)

Backups land in R2 at `db-backups/backup-<UTC timestamp>.dump.gz`
(`pg_dump --format=custom`, gzip-compressed). The most recent few runs and
their verification status are visible in **Admin → Monitoring → Backups**.

1. Download the dump:
   ```sh
   aws s3 cp s3://<R2_BUCKET>/db-backups/backup-<timestamp>.dump.gz . \
     --endpoint-url <R2_ENDPOINT>
   gunzip backup-<timestamp>.dump.gz
   ```
2. Create a fresh Neon project/database (or a branch on a new project).
3. Restore:
   ```sh
   pg_restore --no-owner --no-privileges -d "<new DATABASE_URL>" backup-<timestamp>.dump
   ```
4. Point the Worker's `DATABASE_URL` / `DATABASE_URL_DIRECT` at the new
   database and redeploy, same as steps 4–6 above.

Every backup run's verification already did exactly this restore (into a
throwaway Neon branch, immediately deleted) before the run was marked
"Verified" in Monitoring — if a run shows Verified, these are the same
commands `scripts/backup/verify-restore.sh` just ran successfully. If a run
shows unverified/failed, don't reach for it first; use an earlier verified
one, or fall back to Path 1.

## Backup schedule, rotation, and required secrets

- `.github/workflows/db-backup.yml` — daily at 02:00 UTC. Dumps, uploads to
  R2, rotates (deletes backups older than `BACKUP_RETENTION_DAYS`, default
  14 — flat window, not tiered), verifies via a throwaway Neon branch
  restore, reports into `/api/cron/backup-report`.
- `.github/workflows/uptime-check.yml` — every ~5 minutes, probes the live
  site from outside Cloudflare and reports into `/api/cron/uptime-report`.
- `.github/workflows/app-cron.yml` — replaces `vercel.json`'s cron config,
  which has had no effect since the app moved off Vercel; this is what
  actually drives `/api/cron/scheduled-jobs` and `/api/cron/link-check` now.

GitHub repo secrets these workflows need (Settings → Secrets and variables
→ Actions):

| Secret | Purpose |
| --- | --- |
| `PRODUCTION_URL` | e.g. `https://tbjgrowth.tbjgrowthdev.workers.dev` — where cron/report requests go |
| `CRON_SECRET` | same value as the Worker's `CRON_SECRET` env var |
| `DATABASE_URL_DIRECT` | Neon's **unpooled** connection string — `pg_dump`/`pg_restore` need a direct connection |
| `R2_BUCKET`, `R2_ENDPOINT` | the R2 bucket name and its S3-compatible endpoint URL |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | an R2 API token scoped to that bucket |
| `NEON_API_KEY`, `NEON_PROJECT_ID` | used only to create/delete the throwaway verification branch |

Optional repo variable (Settings → Secrets and variables → Actions →
Variables): `BACKUP_RETENTION_DAYS` (default 14), `MIN_CONTENT_BYTES`
(default 20000 — the uptime check's "does the homepage look empty" threshold).

Run each workflow once manually (Actions tab → the workflow → **Run
workflow**) after adding the secrets, before trusting the schedule.
