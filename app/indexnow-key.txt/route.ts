import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// IndexNow's ownership-verification file — must return exactly the
// configured key as plain text (no trailing newline) at a URL the admin
// controls. See lib/search-engine-ping.ts for where this is submitted.
export async function GET() {
  const settings = await prisma.siteSetting.findFirst();
  return new Response(settings?.indexNowKey || "", { headers: { "Content-Type": "text/plain" } });
}
