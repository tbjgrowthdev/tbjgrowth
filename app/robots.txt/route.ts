import prisma from "@/lib/prisma";
import { cachedSeoFile } from "@/lib/seo-files-cache";

// Dynamic so nothing is built at deploy time; the admin-configured rules are
// cached (see lib/seo-files-cache.ts) and refreshed when settings are saved.
export const dynamic = "force-dynamic";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export async function GET() {
  let customRules = "";
  try {
    customRules = await cachedSeoFile("robots-custom-rules", async () => {
      const settings = await prisma.siteSetting.findFirst({ select: { robotsTxt: true } });
      return settings?.robotsTxt?.trim() || "";
    });
  } catch (error) {
    // Not cached: the next request tries the database again.
    console.error("Failed to load custom robots.txt rules:", error);
  }

  const lines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin/",
    "Disallow: /api/",
    "Disallow: /login",
  ];

  if (customRules) {
    lines.push("", "# Custom rules (admin-configured)", customRules);
  }

  lines.push("", `Sitemap: ${baseUrl}/sitemap.xml`);

  return new Response(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain" },
  });
}
