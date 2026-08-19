import prisma from "@/lib/prisma";

type RedirectEntry = { destination: string; permanent: boolean };

let cache: { map: Map<string, RedirectEntry>; expiresAt: number } | null = null;
const TTL_MS = 60_000;

export async function getRedirectMap(): Promise<Map<string, RedirectEntry>> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.map;
  }

  try {
    const redirects = await prisma.redirect.findMany();
    const map = new Map(redirects.map((r) => [r.source, { destination: r.destination, permanent: r.permanent }]));
    cache = { map, expiresAt: Date.now() + TTL_MS };
    return map;
  } catch (error) {
    console.error("Failed to load redirects:", error);
    return cache?.map ?? new Map();
  }
}

/** Called after admin create/delete/import so new redirects take effect immediately instead of waiting on TTL. */
export function invalidateRedirectCache() {
  cache = null;
}
