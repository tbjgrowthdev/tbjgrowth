# TBJ Growth Tech — Developer Documentation

This is the full developer documentation set for this repo: 16 sections,
each its own file, written by reading the actual code (no fabricated
behavior — anything genuinely ambiguous is flagged as such inside the
relevant doc rather than guessed).

It's a living set, not a one-time snapshot — update the relevant file(s)
whenever the behavior they describe changes, the same way you'd update a
comment next to the code it explains.

1. [Architecture](architecture.md) — stack, deployment target, folder
   layout, the Neon HTTP adapter constraint that shapes a lot of the write
   path.
2. [Database Schema](database-schema.md) — every Prisma model, grouped by
   feature area, with the `DATABASE_URL` (pooled/runtime) vs `DIRECT_URL`
   (unpooled/CLI) split.
3. [API Documentation](api.md) — the real `app/api/**` route surface
   (cron, OAuth callbacks, a couple of public endpoints) plus the Server
   Actions under `app/(admin)/actions/*.ts` that are the actual admin
   "API".
4. [Admin Roles](admin-roles.md) — what roles exist, how a session carries
   one, `requireSession()`/`requirePermission()`/`AuthError`.
5. [Permission Matrix](permission-matrix.md) — every permission string in
   use, mapped against every role.
6. [CMS Workflow](cms-workflow.md) — content statuses, transitions,
   `ApprovalHistory`, reviewer assignment and deadlines, for Posts, Pages,
   and CaseStudies.
7. [AI Workflow](ai-workflow.md) — the AI Content Pipeline's stages, RAG
   and brand-knowledge inputs, provider switching; links to
   `docs/runbooks/ai-content-pipeline.md` for operational detail.
8. [SEO System](seo-system.md) — the large SEO feature suite: internal
   link graph, topic clusters, local SEO, programmatic SEO, experiments,
   change log, performance feedback, audits, content health/refresh/
   recommendations/cannibalization, orphan pages, canonical/hreflang,
   keyword mapping, redirects/link monitoring, GSC/GA4 import, executive
   analytics.
9. [Integration Setup](integration-setup.md) — the Integration Hub
   (Google Business Profile, Meta, CRM, Slack, WordPress, Webhooks) and
   the automation/webhook engine.
10. [Environment Variables](environment-variables.md) — every variable in
    `.env.example`, what uses it, and where real values actually live.
11. [Deployment Process](deployment.md) — build/deploy commands, the
    Cloudflare Workers / OpenNext setup, and the cron trigger story
    (including two routes that currently aren't scheduled anywhere — see
    Known Limitations).
12. [Backup Process](backup-process.md) — what's actually backed up and
    how (not just "Neon's PITR" — there's a real `pg_dump`-to-R2 pipeline
    with restore verification).
13. [Restore Process](restore-process.md) — points to the existing,
    detailed `docs/runbooks/database-restore.md` runbook.
14. [Monitoring](monitoring.md) — the Observability feature: slow queries,
    fingerprinted errors, uptime checks, web vitals, email delivery logs.
15. [Troubleshooting](troubleshooting.md) — concrete symptom → cause → fix
    writeups for the real incidents this repo has already had.
16. [Known Limitations](known-limitations.md) — the Neon HTTP adapter's
    transaction limitation (the big one), schema-drift risk, and a running
    list of smaller issues found but not yet fixed.

## Related, pre-existing docs (not superseded, cross-linked instead)

- `docs/runbooks/ai-content-pipeline.md` — operational detail for the AI
  pipeline.
- `docs/runbooks/database-restore.md` — the actual step-by-step recovery
  procedure.
- `docs/runbooks/security.md` — security posture and secrets handling.

The repo root's `README.md` and `walkthrough.md` predate this set and are
stale; this `docs/` set is the current source of truth.

## Fixed while writing / shortly after this set (see Known Limitations for detail)

- Google OAuth connect routes (`app/api/google/connect`, `/callback`)
  gated on `role !== "ADMIN"` instead of the `INTEGRATION_MANAGEMENT`
  permission the rest of that feature uses, backwards-blocking
  SUPER_ADMIN. Fixed to use `requirePermission("INTEGRATION_MANAGEMENT")`.
- `app/api/cron/orphan-pages-scan` and `app/api/cron/seo-audit-scan`
  existed but weren't wired into any GitHub Actions workflow. Fixed —
  both added to `.github/workflows/app-cron.yml` as weekly Monday jobs.
- Three real production bugs were found and fixed while writing this set
  (not just documented): the Neon HTTP adapter's transaction limitation
  broke "Generate a Day" slot creation, the public booking form, the
  entire content-approval workflow, several bulk admin actions, GSC/GA4
  import, executive analytics, **and all automation rule execution and
  first-time brand-knowledge/prompt-template saves** (the last three
  discovered specifically because of this documentation pass, via a nested
  `relation: { create: {...} }` write that fails the same way). All are
  fixed as of 2026-10-22 — see [Known Limitations](known-limitations.md)
  for the full list and [Troubleshooting](troubleshooting.md) for how to
  recognize the pattern if it shows up again somewhere not yet found.
