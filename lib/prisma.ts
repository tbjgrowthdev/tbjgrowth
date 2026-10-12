import { PrismaClient } from '@/lib/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const connectionString = process.env.DATABASE_URL

// Neon's serverless driver talks over WebSockets/HTTP instead of a raw
// Postgres TCP connection — raw TCP via Cloudflare Workers' connect() sockets
// hangs on Neon's TLS handshake (sslmode=verify-full), so this is required
// for the deployed Worker, not just a preference.
const prismaClientSingleton = () => {
  const adapter = new PrismaNeon({ connectionString })
  return new PrismaClient({ adapter })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma

export default prisma;