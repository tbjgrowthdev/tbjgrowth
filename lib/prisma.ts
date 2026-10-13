import { PrismaClient } from '@/lib/generated/prisma/client'
import { PrismaNeonHttp } from '@prisma/adapter-neon'

const connectionString = process.env.DATABASE_URL as string

// Cloudflare Workers forbids reusing an I/O object (e.g. an open WebSocket)
// across different requests, even within the same long-lived isolate — the
// WebSocket-based PrismaNeon adapter hung on every request after the first
// in a given isolate because of this. PrismaNeonHttp issues a fresh fetch()
// per query instead of holding a connection open, so there's nothing to
// reuse across requests. Tradeoff: no interactive $transaction(async tx =>
// ...) callbacks — only the batched array form, which is all this app uses
// (see app/(admin)/actions/booking.ts for the one callback-form transaction
// that had to be restructured around this).
const prismaClientSingleton = () => {
  const adapter = new PrismaNeonHttp(connectionString, {})
  return new PrismaClient({ adapter })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma

export default prisma;