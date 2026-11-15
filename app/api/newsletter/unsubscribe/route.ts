import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { siteBaseUrl, verifyUnsubscribeToken } from "@/lib/newsletter-unsubscribe";
import { BRAND_NAME } from "@/lib/email";

// The unsubscribe link in every newsletter email (lib/newsletter-unsubscribe.ts).
//   GET  shows a confirm button. It doesn't unsubscribe by itself, because
//        email security scanners open every link in a message.
//   POST unsubscribes. Sent by that button, and by mail apps' one-click
//        "Unsubscribe" (RFC 8058 List-Unsubscribe-Post), which posts to the
//        same URL with the s/t query parameters.
// The signed token is what authorizes it, so there's no session or CSRF
// check: a forged request can't name a subscriber it doesn't have a token for.

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>${escapeHtml(title)} · ${BRAND_NAME}</title>
<style>
  :root { color-scheme: light dark; --bg:#f5f5f4; --card:#fff; --fg:#1f2937; --muted:#6b7280; --accent:#c2410c; }
  @media (prefers-color-scheme: dark) { :root { --bg:#1c1917; --card:#292524; --fg:#f5f5f4; --muted:#a8a29e; --accent:#fb923c; } }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:var(--bg); color:var(--fg); font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; padding:16px; box-sizing:border-box; }
  main { max-width:440px; width:100%; background:var(--card); border-radius:16px; padding:32px 28px; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,.08); }
  h1 { font-size:22px; margin:0 0 12px; }
  p { color:var(--muted); line-height:1.6; margin:0 0 20px; }
  button { font:inherit; font-weight:600; border:0; border-radius:999px; padding:12px 24px; background:var(--accent); color:#fff; cursor:pointer; }
  a { color:var(--accent); }
</style>
</head>
<body><main><h1>${escapeHtml(title)}</h1>${body}<p style="margin:0"><a href="${escapeHtml(siteBaseUrl())}">Back to ${BRAND_NAME}</a></p></main></body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

const invalidLink = () =>
  page("This link doesn't work", "<p>The unsubscribe link is incomplete or invalid. Try the link in a more recent newsletter email, or contact us and we'll remove you.</p>", 400);

function readParams(req: NextRequest) {
  const s = req.nextUrl.searchParams.get("s") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  return { s: s.slice(0, 100), t: t.slice(0, 200) };
}

export async function GET(req: NextRequest) {
  const { s, t } = readParams(req);
  if (!verifyUnsubscribeToken(s, t)) return invalidLink();

  const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { id: s }, select: { status: true } });
  if (!subscriber || subscriber.status === "UNSUBSCRIBED") {
    return page("You're unsubscribed", "<p>You won't get any more newsletter emails from us.</p>");
  }
  const action = `/api/newsletter/unsubscribe?${new URLSearchParams({ s, t })}`;
  return page(
    "Unsubscribe from the newsletter?",
    `<p>You'll stop getting emails about new posts on the ${BRAND_NAME} blog.</p>
     <form method="post" action="${escapeHtml(action)}" style="margin:0 0 20px"><button type="submit">Unsubscribe</button></form>`,
  );
}

export async function POST(req: NextRequest) {
  const { s, t } = readParams(req);
  if (!verifyUnsubscribeToken(s, t)) return invalidLink();

  try {
    const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { id: s }, select: { status: true } });
    if (subscriber && subscriber.status !== "UNSUBSCRIBED") {
      await prisma.newsletterSubscriber.update({ where: { id: s }, data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() } });
    }
  } catch (error) {
    console.error("Newsletter unsubscribe failed:", error);
    return page("Something went wrong", "<p>We couldn't unsubscribe you just now. Please try the link again in a minute.</p>", 500);
  }
  return page("You're unsubscribed", "<p>You won't get any more newsletter emails from us. If you change your mind, you can sign up again on our site.</p>");
}
