import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export async function GET() {
  let customRules = "";
  try {
    const settings = await prisma.siteSetting.findFirst();
    customRules = settings?.robotsTxt?.trim() || "";
  } catch (error) {
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
