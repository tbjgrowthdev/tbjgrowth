# Troubleshooting

Common production issues, how they were diagnosed, and how to recognize
them again. See `docs/known-limitations.md` for the underlying constraints
behind the two biggest issues below.

## "Transactions are not supported in HTTP mode"

**Symptom:** a server action or API route throws this exact string,
usually from inside a Prisma call.

**Cause:** the code path hit a `$transaction([...])` with more than one
operation, or a standalone `createMany`/`updateMany` — all of which the
Neon HTTP adapter (`lib/prisma.ts`) unconditionally rejects. See
`docs/known-limitations.md` for the full mechanism and the list of call
sites already fixed.

**Fix:** replace the transaction/`*Many` call with either sequential
awaited single-statement calls, or `Promise.all` of independent
single-statement calls, depending on whether ordering matters. Look at
`app/(admin)/actions/bulk-posts.ts`'s `bulkChangeStatus` for the house
convention (partial success reported per-item, not all-or-nothing), or
`lib/workflow.ts`'s `transitionContent` for a case where ordering matters
(status update before the audit-trail row).

**If you hit this in a new place:** grep the codebase for `$transaction`
first — every remaining match should be an explanatory comment, not a live
call (confirmed 2026-10-22). If you find a live one, it was missed; fix it
the same way. Also grep for the nested-write shape `: {` followed by
`create:` on the next line (a relation field's nested create) —
`lib/automation/engine.ts`, `lib/brand-kb/brand-kb.ts`, and
`lib/content-pipeline/prompt-library.ts` all had this exact bug too (fixed
2026-10-22): a nested relational create reads like one call but Prisma
compiles it as more than one statement, which fails the same way. See
`docs/known-limitations.md` for the full list of what's been fixed.

## `Invalid prisma.<model>.<op>() invocation: column <X> does not exist` (or `relation does not exist`)

**Symptom:** a Prisma call fails claiming a column or table doesn't exist,
even though it's clearly in `prisma/schema.prisma` and `prisma generate`
has been run.

**Cause:** schema drift — `prisma/schema.prisma` was changed and committed,
but the live database was never actually migrated. This happened in
production on 2026-10-21 (`AiJob.performanceFeedbackId` and ~15 other
features' tables were missing).

**Diagnosis:**
```bash
# Compare the live DB against the schema file. Uses DIRECT_URL (unpooled)
# via prisma.config.ts.
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```
A non-empty, non-trivial diff means the live database is behind.

**Fix (requires explicit confirmation before touching production):**
1. Save the diff output as a real migration file under
   `prisma/migrations/<timestamp>_<name>/migration.sql`.
2. Read it end-to-end and confirm it's additive (new tables/columns/enum
   values) and not dropping or altering anything that could lose data. If
   it drops or alters existing columns, stop and understand why before
   proceeding — that likely means the schema file and the live DB diverged
   in both directions, not just one.
3. Get explicit confirmation before applying anything to production.
4. `npx prisma migrate deploy`
5. Verify three ways: `npx prisma migrate status` (should say "Database
   schema is up to date!"), `npx prisma migrate diff --from-config-datasource
   --to-schema prisma/schema.prisma --exit-code` (should report no
   difference), and spot-check the specific column/table that was
   originally reported missing via `prisma db execute` against
   `information_schema.columns`.

**Prevention:** don't let schema changes sit applied-to-file-but-not-to-DB.
Every `schema.prisma` change should get a real migration generated and
deployed in the same work session it's written in — see
`docs/known-limitations.md`'s "Schema drift" section.

## `P1001: Can't reach database server at ep-*.neon.tech:5432`

**Symptom:** `prisma migrate deploy`/`migrate status`/`db execute` fails to
reach the database, using the unpooled `DIRECT_URL` endpoint.

**Cause:** observed once (2026-10-21) as a transient issue, most likely
Neon's compute waking up from scale-to-zero. It resolved on a bare retry
with no code or config change.

**Fix:** retry the same command once or twice before assuming something is
actually wrong. If it persists past a few retries, check the Neon project
dashboard for the branch's actual status.

## Ad-hoc Node/`tsx` script against the Prisma client throws a WASM import error

**Symptom:**
```
WebAssembly.Instance(): Import #0 "./query_compiler_fast_bg.js"
"__wbg___wbindgen_is_string_fbb76cb2940daafd": function import requires a callable
```

**Cause:** Prisma 7's generated client (`lib/generated/prisma/`) uses a WASM
query-compiler whose bindings only instantiate correctly inside Next.js's
own bundling pipeline. Running the generated client directly via `tsx`
outside of that pipeline doesn't work. This is a tooling limitation, not a
real bug to chase.

**Fix:** don't test Prisma client behavior with standalone scripts. Spin up
the actual `next dev` server and hit a real (temporary, if just for
debugging) route handler instead — that goes through the real Next.js/
webpack pipeline and gives trustworthy results.

## Booking race condition ("double-booked" slot)

**Symptom:** two people appear to book the same slot, or a slot stays
marked booked with no corresponding booking row (or vice versa).

**Cause / current design:** `app/(admin)/actions/booking.ts`'s
`createBooking` cannot use an atomic conditional update (see
`docs/known-limitations.md`), so the real race guard is `Booking.slotId`'s
`@unique` constraint. The flow: mark the slot booked optimistically, then
try to create the booking row; on a unique-constraint violation (`P2002`),
someone else's request already succeeded for that slot — the current
request must report "already booked" and must NOT undo the slot's booked
state (doing so would un-book the other, now-valid booking). On any other
error, the slot is rolled back to unbooked.

**If you see a slot stuck as booked with no booking row:** that implies the
rollback path itself failed (e.g. the DB was unreachable for both the
create and the rollback). Check logs around that timestamp for a thrown
error from `createBooking`, and manually free the slot
(`availableSlot.update({ where: { id }, data: { isBooked: false } })`)
once you've confirmed no legitimate booking exists for it.

## General debugging approach used for live-data-dependent bugs

When a bug only reproduces against real production data/behavior (as both
the schema-drift and transaction bugs did), prefer verifying against the
actual production database over guessing from reading code alone — but do
it safely:
- Use a locally-run `next dev` server hitting a temporary debug route
  (`app/api/<temp-name>/route.ts`), not ad-hoc scripts (see the WASM issue
  above).
- Wrap every test in try/catch with a `finally` that deletes any rows it
  created, using individual `.delete({ where: { id } })` calls collected
  from the operation's own return value (don't depend on a second bulk
  delete call if the very thing you're testing is whether bulk operations
  work).
- Delete the temporary route file (and its now-empty directory) as soon as
  the test is done — never leave a debug route in the tree.
- Never run `prisma migrate dev`/`db push` against the live database. Schema
  changes go through `migrate diff` → reviewed migration file → `migrate
  deploy`, with explicit confirmation before applying to production.
