import { PrismaClient } from '@/lib/generated/prisma/client'
import { PrismaNeonHttp } from '@prisma/adapter-neon'

const connectionString = process.env.DATABASE_URL as string

// Cloudflare Workers forbids reusing an I/O object (e.g. an open WebSocket)
// across different requests, even within the same long-lived isolate — the
// WebSocket-based PrismaNeon adapter hung on every request after the first
// in a given isolate because of this. PrismaNeonHttp issues a fresh fetch()
// per query instead of holding a connection open, so there's nothing to
// reuse across requests. Tradeoff, bigger than it first looks: adapter.
// startTransaction() always rejects with "Transactions are not supported in
// HTTP mode" — not just for interactive $transaction(async tx => ...)
// callbacks, but for the batched array form too as soon as it holds more
// than one operation, AND for Prisma's own internal createMany/updateMany
// (which route through the same path even as a single call). The only
// things that work: a single statement on its own, or several independent
// statements run concurrently via Promise.all with no shared transaction —
// see app/(admin)/actions/booking.ts, bulk-posts.ts, locationFaqs.ts,
// serviceFaqs.ts, lib/workflow.ts, lib/gsc-import.ts, lib/ga4-import.ts, and
// lib/executive-analytics/aggregate.ts for the call sites this forced a
// rewrite of (confirmed live against the Neon database, 2026-10-22).
// Anything slower than this gets a SlowQueryLog row — see that model's
// schema comment for why the bar sits above what a persistent connection
// would use.
const SLOW_QUERY_THRESHOLD_MS = 1000

const prismaClientSingleton = () => {
  const adapter = new PrismaNeonHttp(connectionString, {})
  const base = new PrismaClient({ adapter })

  // Query-timing wrapper for the "slow queries" tile in Observability.
  // Logs via `base` (the un-extended client), never the extended one this
  // function returns, so the logging write itself never re-enters this
  // same hook. Awaited (not fire-and-forget) before returning the result —
  // a Cloudflare Workers invocation isn't guaranteed to keep running an
  // un-awaited promise after the response it belongs to is sent, so an
  // un-awaited write here could silently never happen. Wrapped in try/catch
  // so a logging failure can never surface as a failure of the query it's
  // timing.
  return base.$extends({
    name: 'slow-query-logger',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const start = Date.now()
          const result = await query(args)
          const durationMs = Date.now() - start
          if (durationMs >= SLOW_QUERY_THRESHOLD_MS && model !== 'SlowQueryLog') {
            try {
              await base.slowQueryLog.create({ data: { model: model ?? null, action: operation, durationMs } })
            } catch (err) {
              console.error('Failed to write SlowQueryLog:', err)
            }
          }
          return result
        },
      },
    },
  })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma

export async function getSlowQueryHistory(limit = 50) {
  return prisma.slowQueryLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit })
}

export default prisma;