# Known Limitations

## The Neon HTTP adapter cannot run transactions — at all

This is the single most important constraint in the codebase, and it is not
optional or configurable. It shapes a large fraction of the write-side code
under `app/(admin)/actions/*.ts` and several `lib/*.ts` files.

### Why the app uses the HTTP adapter in the first place

`lib/prisma.ts` constructs the Prisma client with `PrismaNeonHttp` from
`@prisma/adapter-neon`, not the WebSocket-based `PrismaNeon` adapter. This
is deliberate: the app is deployed to Cloudflare Workers (see
`docs/deployment.md`), and Cloudflare Workers forbids reusing an I/O object
— such as an open WebSocket — across different requests, even within the
same long-lived isolate. The WebSocket adapter hung on every request after
the first one in a given isolate because of exactly this. `PrismaNeonHttp`
issues a fresh `fetch()` per query instead of holding a connection open, so
there is nothing to illegally reuse across requests.

### The tradeoff this creates

Reading the adapter's own source
(`@prisma/adapter-neon`'s `PrismaNeonHttpAdapter.startTransaction()`) shows
an unconditional rejection:

```js
async startTransaction() {
  return Promise.reject(new Error("Transactions are not supported in HTTP mode"));
}
```

This was empirically verified live against the production database
(2026-10-22) via a temporary, self-cleaning debug route run through a real
`next dev` server (ad-hoc scripts against the generated Prisma client don't
work standalone — see the note at the bottom of this doc). The confirmed
scope:

| Operation | Standalone | Inside `$transaction([...])` |
|---|---|---|
| Single `create` / `update` / `delete` / `upsert` / `findX` | ✅ works | ✅ works (array of 1 is a no-op wrapper) |
| `deleteMany({ where })` | ✅ works, even with a zero-match `where` | — |
| `createMany({ data: [...] })` | ❌ **fails**, even with just 2 rows | ❌ fails |
| `updateMany({ where, data })` | ❌ **fails**, even with a zero-match `where` | ❌ fails |
| Nested relational create, e.g. `prisma.x.create({ data: { ..., rel: { create: {...} } } })` | ❌ **fails**, even a single nested row | ❌ fails |
| Two or more operations, any type/model mix | n/a | ❌ **always fails** |

The reason `deleteMany` is the one exception: a `DELETE ... WHERE ...`'s
affected-row count is a native, single-statement Postgres result. Multi-row
`createMany`/`updateMany`, a nested relational `create` (even a single
nested row — e.g. `prisma.automationRun.create({ data: { steps: { create:
[...] } } } })`, which is two tables in one call), and any multi-operation
`$transaction` batch all require a real `BEGIN`/`COMMIT` round-trip under
this engine version, which the HTTP adapter cannot provide. Watch for this
one specifically — a nested create reads like an ordinary single call and
is easy to write without realizing it's actually a multi-statement write
under the hood.

**The only two things that reliably work for "many writes in one action":**

1. A single statement on its own (including `deleteMany`).
2. Several independent statements run concurrently via `Promise.all`, with
   no shared transaction — accepting that this is NOT atomic. A failure
   partway through leaves some writes committed and others not.

### Where this forced real design changes, not just a mechanical swap

Fixed call sites (as of 2026-10-22), each rewritten from `$transaction`/
`createMany`/`updateMany` to either sequential awaits or `Promise.all`:

- `app/(admin)/actions/booking.ts` — `createSlotsBulk` ("Generate a Day")
  and `createBooking` (the public `/book-a-call` form). `createBooking` is
  the interesting one: it used to use `updateMany({ where: { id, isBooked:
  false }, data: { isBooked: true } })` as an atomic "claim only if free"
  check. Since standalone `updateMany` never works here, the race guard was
  redesigned around `Booking.slotId`'s pre-existing `@unique` constraint
  instead — two requests can both pass the `isBooked` read-check, but only
  one `booking.create()` can ever succeed for a given `slotId`; the loser
  gets a `P2002` and must NOT roll the slot back to unbooked (the winner's
  booking is valid), while any other error safely does roll it back.
- `lib/workflow.ts` — `transitionContent`, `assignUser`,
  `setReviewDeadline`. This is the most severe one: it underlies every
  content-approval action (submit, approve, reject, publish, unpublish,
  archive, restore, assign reviewer, set deadline) for Posts, Pages, and
  CaseStudies sitewide. The status update and its `ApprovalHistory` audit
  row used to be one 2-element `$transaction` array — this had been
  silently broken. Fixed with sequential awaits: the status update first
  (the change that matters), then the audit row — so a rare failure
  writing history leaves the real transition intact rather than losing it.
- `app/(admin)/actions/locationFaqs.ts` / `serviceFaqs.ts` — replacing a
  FAQ list: `deleteMany` (safe standalone) followed by `Promise.all` of
  individual `create()` calls instead of a `createMany`/`$transaction`.
- `app/(admin)/actions/bulk-posts.ts` — bulk category/tag assignment
  (`$transaction` array → `Promise.all`), bulk author reassignment and bulk
  SEO updates (`updateMany` → `Promise.all` of per-row `update()`). This
  matches a pattern that already existed correctly elsewhere in the same
  file (`bulkChangeStatus`/`bulkSchedule` already used `Promise.all` with
  per-item partial-success semantics — the house convention this fix
  generalized from).
- `lib/executive-analytics/aggregate.ts` — a 3-count `$transaction` (purely
  independent reads, no atomicity need) → `Promise.all`.
- `lib/gsc-import.ts` / `lib/ga4-import.ts` — chunked `$transaction` of
  `upsert()` calls for the GSC/GA4 metric import cron jobs → `Promise.all`.
  Safe because upserts are idempotent and independently keyed.
- `lib/automation/engine.ts` — `startRun()`, the function behind every
  automation rule execution (triggered by `fireAutomationEvent` on content
  publish/ranking-decline/etc., and by the "Run Now" button) used a nested
  `automationRun.create({ data: { steps: { create: [...] } } } })`. This
  meant **no automation rule had ever actually run successfully in
  production** — every run attempt threw before a single `AutomationRun`
  row could be created. Fixed to create the run first, then
  `Promise.all` the step rows against its real id.
- `lib/brand-kb/brand-kb.ts` (`saveBrandSectionVersion`) and
  `lib/content-pipeline/prompt-library.ts` (`savePromptVersion`) — both
  used the identical nested-create shape (`versions: { create: {...} }`)
  for a brand-new section/template's first version. Same fix: create the
  parent row, then the version row, then point `activeVersionId` at it
  (the update-existing-section/template path two lines below each of
  these was already written as separate sequential calls and was fine).

**If you add a new bulk-write action:** default to `Promise.all` over
independent per-row operations, and explicitly decide whether partial
success is acceptable for that action (it usually is — see
`bulkChangeStatus`'s comment in `bulk-posts.ts`). If you need real
atomicity across multiple statements, this adapter cannot give it to you;
you'd need to either accept partial-failure handling in application code,
or move that one call site to a non-HTTP connection path.

### What was NOT re-verified

`$executeRaw`/`$queryRaw` for a single multi-row `INSERT ... VALUES (...),
(...)` or `UPDATE ... FROM (VALUES ...)` statement was never actually
tested — an attempt was blocked by tooling before it could reach the dev
server. It's plausible a single raw multi-row statement would work (it's
one statement, no transaction needed), but this is unconfirmed. The
codebase currently has zero raw SQL anywhere, so this isn't an in-use
pattern — if someone wants multi-row atomic writes badly enough to reach
for raw SQL, verify it live against a non-production database first.

### A note on how this was diagnosed

Ad-hoc Node/`tsx` scripts against the generated Prisma client
(`lib/generated/prisma/*`) don't work for testing this — Prisma 7's
generated client uses a WASM query-compiler whose bindings only
instantiate correctly inside Next.js's own bundling pipeline. Running it
via plain `tsx` throws an unrelated WASM import error. Reliable testing
requires a real `next dev` server and an actual route handler.

## Other findings from writing this documentation (fixed 2026-10-22)

Surfaced while researching the docs set below, and fixed as a follow-up
once documented:

- **Google OAuth connect routes gated on the wrong check.**
  `app/api/google/connect` and `app/api/google/callback` checked
  `role !== "ADMIN"` literally, instead of the `INTEGRATION_MANAGEMENT`
  permission the rest of the Google integration code
  (`lib/google-oauth.ts`, `lib/integrations/manage.ts`) uses. Since
  `INTEGRATION_MANAGEMENT` is SUPER_ADMIN-only in the real permission map
  (see `docs/permission-matrix.md`), this blocked SUPER_ADMIN from the
  OAuth connect flow while letting a plain ADMIN through — backwards from
  what the rest of that feature intends. Fixed: both routes now call
  `requirePermission("INTEGRATION_MANAGEMENT")` from `lib/auth-guard.ts`,
  same as every other integration-management call site — which also
  picks up session-revocation checking for free, which the old
  `getServerSession` + manual role check never had.
- **Two cron routes existed but weren't actually scheduled.**
  `app/api/cron/orphan-pages-scan` and `app/api/cron/seo-audit-scan` both
  check `CRON_SECRET` like every other cron route, but neither was wired
  into any `.github/workflows/*.yml` trigger. Fixed: added to
  `.github/workflows/app-cron.yml` as two more Monday jobs (`0 8 * * 1`
  orphan pages, `0 9 * * 1` SEO audit), following the exact pattern the
  other weekly scans there already use. Each still needs one manual
  **Run workflow** trigger (Actions tab) the first time, same as every
  other job in that file, to confirm `PRODUCTION_URL`/`CRON_SECRET` are
  configured correctly before trusting the schedule.

## Schema drift between `prisma/schema.prisma` and the live database is a real, recurring risk

This has already happened once in production (2026-10-21/22): several
features' worth of schema changes (new enums, tables, and one new column
on `AiJob`) were committed to `prisma/schema.prisma` and `prisma generate`
was run, but `prisma migrate deploy` was never actually run against the
live Neon database — because of an overly cautious habit of avoiding
`prisma migrate dev`/`db push` against production without ever replacing
that step with the safe equivalent (`migrate diff` → review → migration
file → `migrate deploy`). The result: the live app crashed on columns that
existed in code but not in the database (`column AiJob.performanceFeedbackId
does not exist`).

**The fix going forward:** whenever `prisma/schema.prisma` changes, generate
a migration (`prisma migrate diff --from-config-datasource --to-schema
prisma/schema.prisma --script`, which reads `DIRECT_URL` from
`prisma.config.ts`), review it, save it under `prisma/migrations/`, and run
`prisma migrate deploy` — with a human reviewing the diff before it touches
production, same as the 2026-10-22 recovery did. Never let a schema change
sit un-applied "for later."

See `docs/troubleshooting.md` for the recovery steps if this happens again,
and `docs/database-schema.md` for the `DATABASE_URL` (pooled, runtime) vs
`DIRECT_URL` (unpooled, CLI/migrations) split that's easy to confuse when
debugging this.
