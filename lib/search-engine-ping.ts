/**
 * IndexNow push notifications — the modern replacement for the legacy
 * Google/Bing "sitemap ping" endpoints (Google retired its ping endpoint in
 * 2023). One POST to api.indexnow.org fans a URL out to every participating
 * engine (Bing, Yandex, Seznam, Naver, and others), so this is the single
 * "configured search engine notification" integration point rather than a
 * handful of separate ad-hoc pings.
 *
 * Configured entirely from Settings: an enabled toggle and a key the admin
 * generates there (see generateIndexNowKey in actions/settings.ts). The key
 * is also served back at /indexnow-key.txt — IndexNow verifies ownership of
 * a domain by checking that the exact key you submit is readable at a URL
 * you control, which is why that route exists.
 *
 * Fire-and-forget by design, same as lib/email.ts's notifications: a failed
 * or skipped ping must never block the publish it's attached to. Search
 * engines still discover the URL via the sitemap regardless — this is a
 * courtesy that speeds that up, not a correctness requirement.
 */
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export async function ensureIndexNowKey(regenerate = false): Promise<string> {
  let settings = await prisma.siteSetting.findFirst();
  if (!settings) {
    settings = await prisma.siteSetting.create({ data: { phone: "", email: "", address: "" } });
  }
  if (settings.indexNowKey && !regenerate) {
    return settings.indexNowKey;
  }
  const key = randomBytes(16).toString("hex");
  await prisma.siteSetting.update({ where: { id: settings.id }, data: { indexNowKey: key } });
  return key;
}

export async function notifySearchEnginesOfUrl(path: string): Promise<void> {
  try {
    const settings = await prisma.siteSetting.findFirst();
    if (!settings?.indexNowEnabled || !settings.indexNowKey) return;

    const url = `${baseUrl}${path}`;
    const host = new URL(baseUrl).host;

    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: settings.indexNowKey,
        keyLocation: `${baseUrl}/indexnow-key.txt`,
        urlList: [url],
      }),
    });

    await logAudit({
      action: "notify",
      category: "Integrations",
      entityType: "IndexNow",
      entityLabel: url,
      after: { status: res.status, ok: res.ok },
    });
  } catch (error) {
    console.error(`IndexNow notification failed for ${path}:`, error);
  }
}
