import { baseUrl, renderSitemapIndexXml } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

// The submitted-to-Search-Console URL stays "/sitemap.xml" — only its
// content changed, from one combined <urlset> to a <sitemapindex> pointing
// at the five content-specific child sitemaps below. Google/Bing both
// accept an index at the same URL you'd otherwise submit a flat sitemap at,
// so nothing needs re-submitting.
export async function GET() {
  const now = new Date();
  const xml = renderSitemapIndexXml([
    { url: `${baseUrl}/sitemap-static.xml`, lastModified: now },
    { url: `${baseUrl}/sitemap-pages.xml`, lastModified: now },
    { url: `${baseUrl}/sitemap-posts.xml`, lastModified: now },
    { url: `${baseUrl}/sitemap-case-studies.xml`, lastModified: now },
    { url: `${baseUrl}/sitemap-services.xml`, lastModified: now },
  ]);
  return new Response(xml, {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}
