import { getServiceEntries, renderUrlsetXml } from "@/lib/sitemap";
import { cachedSeoFile, xmlResponse } from "@/lib/seo-files-cache";

// Dynamic so nothing is built at deploy time; the XML itself is cached (see lib/seo-files-cache.ts).
export const dynamic = "force-dynamic";

export async function GET() {
  return xmlResponse(await cachedSeoFile("sitemap-services", async () => renderUrlsetXml(await getServiceEntries())));
}
