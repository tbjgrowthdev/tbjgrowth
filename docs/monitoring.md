# Monitoring

This app has no Sentry/Datadog-style SDK. `lib/observability/aggregate.ts`
says why directly: *"Deliberately NOT using the Sentry SDK here: this
Worker has already broken twice this session from new runtime
dependencies hitting Cloudflare Workers restrictions (WASM compile,
persistent-connection reuse), so error capture goes through the same
plain-fetch-based approach as everything else."* Everything below is
first-party instrumentation, rolled up into one dashboard
(**Admin → Observability**, `app/(admin)/admin/observability`,
`components/Admin/Observability/ObservabilityClient.tsx`).

`getObservabilityData(hours)` (`lib/observability/aggregate.ts`) is the
single query that builds the whole dashboard, gated behind
`SETTINGS_MANAGEMENT` permission. It takes a time window — 24h / 7d / 30d
(`WINDOW_OPTIONS` in `lib/observability/types.ts`) — and returns three
groups, matching the dashboard's three sections:

## Application

- **Errors** — every server error (via Next's `onRequestError` hook in
  `instrumentation.ts`, which fires for Server Components, Route
  Handlers, Server Actions, and Middleware without touching call sites
  individually) and every client-side crash (POSTed to
  `app/api/internal/client-error`, unauthenticated by necessity — a
  crashed client can't carry a session) land in one `ErrorLog` table via
  `lib/error-monitor.ts`'s `captureError()`. The dashboard's "Errors" and
  "Exceptions" are the same signal here — there's no second, independently
  meaningful tracker to split them from.
  - Each error gets a cheap non-cryptographic `fingerprint` (hash of
    `path::message`) so repeated occurrences of the same error dedupe for
    alerting purposes — alerts fire on the *first* occurrence of a
    fingerprint per 30-minute window, not every single one (otherwise a
    real incident would mean one email per request).
  - `apiFailureCount` is just server errors whose path starts with `/api`.
- **Slow queries** — `lib/prisma.ts` wraps every Prisma call in a
  `$extends` query hook that times it and writes a `SlowQueryLog` row
  (model, action, durationMs) for anything ≥ `SLOW_QUERY_THRESHOLD_MS`
  (1000ms). Logs via the un-extended base client so the logging write
  itself can never recursively re-enter the same hook, and the write is
  **awaited**, not fire-and-forget — a Workers invocation isn't guaranteed
  to keep running an un-awaited promise after its response is sent.
- **Slow requests** — reuses `WebVitalSample` (see below): counts
  poor-rated `TTFB` samples in the window rather than adding a second,
  separate "page load time" tracker.

## Infrastructure

- **Database reachability/latency** — pings `prisma.siteSetting.count()`
  live, on every dashboard load; not historical.
- **API latency trend** — built from `UptimeCheck` rows (see below), not a
  separate APM tool.
- Deliberately **excluded**: CPU/RAM/disk/storage. This app runs on
  Cloudflare Workers, which exposes none of that to application code —
  those numbers belong in the Cloudflare dashboard (Workers & Pages → the
  Worker → Metrics) and the Cloudinary/R2 dashboards, not duplicated here.

## Business

- **Failed publishing** — `ScheduledJob` rows with `status: FAILED` in the
  window.
- **Failed AI jobs** — `AiJob` rows with `status: FAILED`.
- **Failed integrations** — any Integration Hub provider (or mirrored
  Google/AI/email status) currently `ERROR` — reuses
  `listIntegrationStatuses()` from `lib/integrations/manage.ts` directly,
  see `docs/integration-setup.md`.
- **Failed webhooks** — `AutomationStepRun` rows where `actionType:
  NOTIFY_TEAM`, `status: FAILED`, and the step's own `config.channel ===
  "webhook"` — `NOTIFY_TEAM` also covers Slack and email, which are
  different failure categories already covered by Integrations/EmailLog
  respectively, so this filters to webhook-channel steps specifically.
- **Failed emails** — `EmailLog` rows with `success: false`. `EmailLog`
  was added specifically to make this tile honest (see
  `lib/observability/aggregate.ts`'s own comment: *"The two genuinely new
  pieces of instrumentation it depends on (EmailLog, SlowQueryLog) were
  added ... specifically to make this dashboard honest rather than
  fabricated."*)

## External, CI-run probes (feed Infrastructure, not app-internal)

- **Uptime** — `.github/workflows/uptime-check.yml` curls the live site
  from *outside* Cloudflare every ~5 minutes and POSTs the result to
  `app/api/cron/uptime-report`, recorded by `lib/uptime-monitor.ts` into
  `UptimeCheck`. Runs externally on purpose: a probe running inside the
  Worker can't detect the Worker itself being unreachable. Checks both
  `up` (status code) and `contentOk` (a minimum-content-length heuristic)
  separately — a degraded DB can still serve a 200 with an empty page,
  which happened once in production and an HTTP-status-only check would
  have missed entirely. Alerts only on a state *change* (healthy↔unhealthy),
  not on every failed probe, since probing every 5 minutes would otherwise
  mean an email every 5 minutes for the whole duration of a real outage.
- **Backups** — see `docs/backup-process.md` / `docs/monitoring.md`'s
  sibling doc; surfaced in **Admin → Monitoring → Backups**, a separate,
  older page from the Observability dashboard above.
- **Web vitals** — the client posts real-user `LCP`/`CLS`/`INP`/`FCP`/`TTFB`
  samples to `app/api/web-vitals`, stored as `WebVitalSample` rows.

## Two monitoring surfaces exist — don't confuse them

- **Admin → Observability** (`/admin/observability`) — the dashboard
  described above: Application/Infrastructure/Business, built this
  session, reads from `ErrorLog`/`SlowQueryLog`/`EmailLog`/`UptimeCheck`/
  `WebVitalSample`/`ScheduledJob`/`AiJob`/`AutomationStepRun`/Integrations.
- **Admin → Monitoring** (`/admin/monitoring`, older) — mainly the Backups
  history view (`getBackupHistory()`), plus whatever pre-existing checks
  were already there before Observability was added. If you're adding a
  new signal, check whether it belongs in Observability's existing three
  groups before creating a fourth monitoring surface.
