import { getLocationEntries, renderUrlsetXml } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export async function GET() {
  const xml = renderUrlsetXml(await getLocationEntries());
  return new Response(xml, {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}
