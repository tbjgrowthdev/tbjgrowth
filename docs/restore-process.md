# Restore process

The actual step-by-step recovery procedure lives in
**[`docs/runbooks/database-restore.md`](runbooks/database-restore.md)** —
this page doesn't repeat it. Read that runbook first. This page only adds
context the runbook doesn't cover: what the app itself records about each
backup, and where that's surfaced.

## Summary of the two recovery paths (detail in the runbook)

1. **Neon point-in-time restore** — the default choice. Faster, no manual
   schema/data reconciliation, covers anything within Neon's own WAL
   retention window.
2. **Restore from an R2 `pg_dump`** — only needed if the Neon project
   itself is unusable or the incident predates the PITR window. See
   `docs/backup-process.md` for how those dumps get created in the first
   place.

Both paths end the same way: point the Worker's `DATABASE_URL` /
`DATABASE_URL_DIRECT` at the restored database (Cloudflare dashboard →
Workers & Pages → the Worker → Settings → Variables and Secrets) and
redeploy.

## What the app adds on top of the runbook

- **`lib/backup-monitor.ts`** is where every backup run's metadata lands
  (`BackupRun` table) — `startedAt`, `completedAt`, `success`, `verified`,
  `objectKey`, `error`. This is populated by `app/api/cron/backup-report`,
  which is called from `.github/workflows/db-backup.yml` after it runs
  (see `docs/backup-process.md`).
- **Only pick a `verified: true` run when restoring from R2.** The runbook
  is explicit about this: every backup's verification step already ran
  the exact `pg_restore` command the runbook gives you, into a throwaway
  Neon branch, before marking the run "Verified." If a run shows
  unverified or failed, don't reach for it first — use an earlier
  verified one, or fall back to the Neon PITR path instead.
- **Where to see run history as an admin**: `getBackupHistory()` in
  `lib/backup-monitor.ts` feeds **Admin → Monitoring → Backups** — that's
  where you find the `objectKey` (the R2 path, `db-backups/backup-<UTC
  timestamp>.dump.gz`) for whichever run you're restoring from, and
  confirm its `verified` status before starting.
- **Verifying the restore worked** (runbook step 6): hit
  `/api/internal/env-check` and the homepage. The runbook specifically
  calls out checking "content OK," not just a 200 status — this echoes
  the same distinction the uptime monitor makes (`contentOk` vs. plain
  reachability, see `docs/monitoring.md`): a degraded DB can still serve a
  200 with an empty page.
