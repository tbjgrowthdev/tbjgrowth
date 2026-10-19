import { getServiceEntries, renderUrlsetXml } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export async function GET() {
  const xml = renderUrlsetXml(await getServiceEntries());
  return new Response(xml, {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}
