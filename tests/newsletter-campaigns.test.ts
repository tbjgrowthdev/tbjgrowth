// Run with: npm test
//
// Drives lib/newsletter-campaigns.ts and the unsubscribe route through the
// real lib/email.ts, with a fake database and a fake Resend (fetch), so the
// tests see exactly which emails would go to whom.
import { test, mock, beforeEach, after as afterAll } from "node:test";
import assert from "node:assert/strict";

type Sub = { id: string; email: string; status: "ACTIVE" | "UNSUBSCRIBED"; createdAt: Date; unsubscribedAt: Date | null };
type Campaign = {
  id: string; postId: string; postTitle: string; postSlug: string; status: string; cursor: string | null; cutoff: Date;
  sentCount: number; attempts: number; lastError: string | null; lockedUntil: Date | null; createdAt: Date; completedAt: Date | null;
};
type Post = { id: string; title: string; slug: string; excerpt: string | null; featuredImage: string | null; status: string };

let autoSend = true;
let subs: Sub[] = [];
let campaigns: Campaign[] = [];
let posts: Post[] = [];
let resendCalls: Array<{ key: string; emails: Array<{ to: string[]; subject: string; html: string; text: string; headers: Record<string, string> }> }> = [];
let resendResponses: Array<{ status: number; body: string }> = [];
const afterCallbacks: Array<() => unknown> = [];

function p2025() {
  return Object.assign(new Error("Record to update not found."), { code: "P2025" });
}

function matchesCampaignWhere(c: Campaign, where: Record<string, unknown>) {
  if (where.id && c.id !== where.id) return false;
  if (where.status && c.status !== where.status) return false;
  if (where.OR) {
    const now = Date.now();
    const ok = (where.OR as Array<Record<string, unknown>>).some((cond) =>
      cond.lockedUntil === null ? c.lockedUntil === null : c.lockedUntil !== null && c.lockedUntil.getTime() < now,
    );
    if (!ok) return false;
  }
  return true;
}

const fakePrisma = {
  siteSetting: { async findFirst() { return { newsletterAutoSend: autoSend }; } },
  emailLog: { async create() {} },
  post: { async findUnique({ where }: { where: { id: string } }) { return posts.find((p) => p.id === where.id) ?? null; } },
  newsletterCampaign: {
    async create({ data }: { data: Partial<Campaign> }) {
      if (campaigns.some((c) => c.postId === data.postId)) throw Object.assign(new Error("Unique"), { code: "P2002" });
      const now = new Date();
      const row: Campaign = { id: `camp_${campaigns.length + 1}`, status: "SENDING", cursor: null, cutoff: now, sentCount: 0, attempts: 0, lastError: null, lockedUntil: null, createdAt: now, completedAt: null, postId: "", postTitle: "", postSlug: "", ...data };
      campaigns.push(row);
      return { ...row };
    },
    async findMany({ where }: { where: { status: string } }) { return campaigns.filter((c) => c.status === where.status).map((c) => ({ ...c })); },
    async findUnique({ where }: { where: { id: string } }) { const c = campaigns.find((x) => x.id === where.id); return c ? { ...c } : null; },
    async update({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      const c = campaigns.find((x) => matchesCampaignWhere(x, where));
      if (!c) throw p2025();
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === "object" && "increment" in (v as object)) (c as Record<string, unknown>)[k] = ((c as Record<string, unknown>)[k] as number) + (v as { increment: number }).increment;
        else (c as Record<string, unknown>)[k] = v;
      }
      return { ...c };
    },
  },
  newsletterSubscriber: {
    async findMany({ where, take }: { where: { status: string; createdAt: { lte: Date }; id?: { gt: string } }; take: number }) {
      return subs
        .filter((s) => s.status === where.status && s.createdAt <= where.createdAt.lte && (!where.id || s.id > where.id.gt))
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .slice(0, take)
        .map((s) => ({ id: s.id, email: s.email }));
    },
    async findUnique({ where }: { where: { id: string } }) { return subs.find((s) => s.id === where.id) ?? null; },
    async update({ where, data }: { where: { id: string }; data: Partial<Sub> }) {
      const s = subs.find((x) => x.id === where.id);
      if (!s) throw p2025();
      Object.assign(s, data);
      return s;
    },
  },
};

mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma }, defaultExport: fakePrisma });
// lib/sitemap pulls in next-auth via lib/translation; only the path builder is needed.
mock.module("@/lib/sitemap", { namedExports: { PUBLIC_PATH_BUILDERS: { POST: (slug: string) => `/blog/${slug}` } } });
mock.module("next/server", { namedExports: { after: (cb: () => unknown) => void afterCallbacks.push(cb), NextRequest: class {} } });

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (url: string, init: { headers: Record<string, string>; body: string }) => {
  assert.equal(url, "https://api.resend.com/emails/batch");
  const next = resendResponses.shift() ?? { status: 200, body: "{}" };
  resendCalls.push({ key: init.headers["Idempotency-Key"], emails: JSON.parse(init.body) });
  return new Response(next.body, { status: next.status });
}) as typeof fetch;

process.env.NEXTAUTH_SECRET = "test-secret";
process.env.RESEND_API_KEY = "test-key";
process.env.RESEND_FROM_EMAIL = "TBJ Growth <news@tbj.example>";
process.env.NEXT_PUBLIC_BASE_URL = "https://tbj.example";

const { queuePostNewsletter, processNewsletterCampaigns, MAX_ATTEMPTS } = await import("../lib/newsletter-campaigns");
const { unsubscribeUrl, verifyUnsubscribeToken, unsubscribeToken } = await import("../lib/newsletter-unsubscribe");
const route = await import("../app/api/newsletter/unsubscribe/route");

const POST_1: Post = { id: "post_1", title: "Growth & SEO in 2027", slug: "growth-seo-2027", excerpt: "What changed.", featuredImage: "/uploads/cover.png", status: "PUBLISHED" };

function addSubs(n: number, opts: Partial<Sub> = {}) {
  const start = subs.length;
  for (let i = 0; i < n; i++) {
    const idx = start + i;
    subs.push({ id: `sub_${String(idx).padStart(5, "0")}`, email: `person${idx}@example.com`, status: "ACTIVE", createdAt: new Date(Date.now() - 60_000), unsubscribedAt: null, ...opts });
  }
}

const allRecipients = () => resendCalls.flatMap((c) => c.emails.map((e) => e.to[0]));

beforeEach(() => {
  autoSend = true;
  subs = [];
  campaigns = [];
  posts = [{ ...POST_1 }];
  resendCalls = [];
  resendResponses = [];
  afterCallbacks.length = 0;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

test("switch off: publishing queues nothing", async () => {
  autoSend = false;
  assert.equal(await queuePostNewsletter(POST_1), "off");
  assert.equal(campaigns.length, 0);
});

test("switch on: queues once per post, ever, and starts sending after the response", async () => {
  assert.equal(await queuePostNewsletter(POST_1), "queued");
  assert.equal(afterCallbacks.length, 1);
  assert.equal(await queuePostNewsletter(POST_1), "exists");
  assert.equal(campaigns.length, 1);
});

test("emails each active subscriber once, with their own unsubscribe link, skipping unsubscribed people", async () => {
  addSubs(3);
  addSubs(1, { status: "UNSUBSCRIBED" });
  await queuePostNewsletter(POST_1);
  await afterCallbacks[0]();

  assert.equal(resendCalls.length, 1);
  assert.deepEqual(allRecipients(), ["person0@example.com", "person1@example.com", "person2@example.com"]);
  const first = resendCalls[0].emails[0];
  assert.equal(first.subject, "Growth & SEO in 2027");
  const link = unsubscribeUrl("sub_00000");
  assert.ok(first.html.includes(link.replace(/&/g, "&amp;")), "html has this subscriber's unsubscribe link");
  assert.ok(first.text.includes(`Unsubscribe: ${link}`));
  assert.equal(first.headers["List-Unsubscribe"], `<${link}>`);
  assert.equal(first.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.ok(first.html.includes("https://tbj.example/blog/growth-seo-2027"));
  assert.ok(first.html.includes("https://tbj.example/uploads/cover.png"));
  // Different subscribers get different links.
  assert.notEqual(resendCalls[0].emails[1].headers["List-Unsubscribe"], first.headers["List-Unsubscribe"]);

  assert.equal(campaigns[0].status, "SENT");
  assert.equal(campaigns[0].sentCount, 3);
  assert.equal(campaigns[0].lockedUntil, null);
});

test("people who subscribe after the post was queued don't get it", async () => {
  addSubs(2);
  await queuePostNewsletter(POST_1);
  subs.push({ id: "sub_late", email: "late@example.com", status: "ACTIVE", createdAt: new Date(Date.now() + 60_000), unsubscribedAt: null });
  await processNewsletterCampaigns();
  assert.ok(!allRecipients().includes("late@example.com"));
});

test("large lists go out in batches of 100 across runs, everyone exactly once", async () => {
  addSubs(250);
  await queuePostNewsletter(POST_1);

  await processNewsletterCampaigns(1);
  assert.equal(resendCalls.length, 1);
  assert.equal(campaigns[0].status, "SENDING");
  assert.equal(campaigns[0].sentCount, 100);

  await processNewsletterCampaigns();
  assert.equal(resendCalls.length, 3);
  const recipients = allRecipients();
  assert.equal(recipients.length, 250);
  assert.equal(new Set(recipients).size, 250);
  assert.equal(new Set(resendCalls.map((c) => c.key)).size, 3, "each batch has its own idempotency key");
  assert.equal(campaigns[0].status, "SENT");
  assert.equal(campaigns[0].sentCount, 250);

  // Nothing more on later runs.
  await processNewsletterCampaigns();
  assert.equal(resendCalls.length, 3);
});

test("a failed batch is retried with the same idempotency key, then marked failed after the attempt limit", async () => {
  addSubs(2);
  await queuePostNewsletter(POST_1);
  resendResponses = [{ status: 500, body: "boom" }, { status: 200, body: "{}" }];

  await processNewsletterCampaigns();
  assert.equal(campaigns[0].status, "SENDING");
  assert.equal(campaigns[0].attempts, 1);
  assert.equal(campaigns[0].lockedUntil, null);
  await processNewsletterCampaigns();
  assert.equal(resendCalls[0].key, resendCalls[1].key);
  assert.equal(campaigns[0].status, "SENT");
  assert.equal(campaigns[0].attempts, 0);

  // A campaign that keeps failing gives up.
  posts.push({ ...POST_1, id: "post_2", slug: "two" });
  await queuePostNewsletter({ id: "post_2", title: "Two", slug: "two" });
  resendResponses = Array.from({ length: MAX_ATTEMPTS }, () => ({ status: 503, body: "down" }));
  for (let i = 0; i < MAX_ATTEMPTS; i++) await processNewsletterCampaigns();
  assert.equal(campaigns[1].status, "FAILED");
  assert.ok(campaigns[1].lastError?.includes("down"));
});

test("a 409 for a key already used counts the batch as sent and moves on", async () => {
  addSubs(2);
  await queuePostNewsletter(POST_1);
  resendResponses = [{ status: 409, body: '{"name":"invalid_idempotent_request"}' }];
  await processNewsletterCampaigns();
  assert.equal(campaigns[0].cursor, "sub_00001");
  assert.equal(campaigns[0].status, "SENT", "nobody is left after that batch");
  assert.equal(campaigns[0].sentCount, 0, "not counted twice");
  await processNewsletterCampaigns();
  assert.equal(resendCalls.length, 1, "the batch isn't resent");
});

test("a campaign locked by another run isn't sent twice at once", async () => {
  addSubs(2);
  await queuePostNewsletter(POST_1);
  campaigns[0].lockedUntil = new Date(Date.now() + 60_000);
  await processNewsletterCampaigns();
  assert.equal(resendCalls.length, 0);
  // An expired lock (a crashed run) is taken over.
  campaigns[0].lockedUntil = new Date(Date.now() - 1);
  await processNewsletterCampaigns();
  assert.equal(resendCalls.length, 1);
});

test("a post unpublished or deleted before sending is cancelled, not sent", async () => {
  addSubs(2);
  await queuePostNewsletter(POST_1);
  posts[0].status = "DRAFT";
  await processNewsletterCampaigns();
  assert.equal(resendCalls.length, 0);
  assert.equal(campaigns[0].status, "CANCELLED");
});

test("turning the switch off stops a run before anything is sent", async () => {
  addSubs(2);
  await queuePostNewsletter(POST_1);
  autoSend = false;
  assert.equal((await processNewsletterCampaigns()).skipped, "off");
  assert.equal(resendCalls.length, 0);
});

test("unsubscribe tokens can't be forged or reused for another subscriber", () => {
  const t = unsubscribeToken("sub_1");
  assert.equal(verifyUnsubscribeToken("sub_1", t), true);
  assert.equal(verifyUnsubscribeToken("sub_2", t), false);
  assert.equal(verifyUnsubscribeToken("sub_1", t.slice(0, -1) + (t.endsWith("A") ? "B" : "A")), false);
  assert.equal(verifyUnsubscribeToken("sub_1", ""), false);
});

function req(url: string) {
  return { nextUrl: new URL(url) } as unknown as Parameters<typeof route.GET>[0];
}

test("unsubscribe link: opening it only asks; confirming unsubscribes; later posts skip them", async () => {
  addSubs(2);
  const url = unsubscribeUrl("sub_00000");

  const shown = await route.GET(req(url));
  assert.equal(shown.status, 200);
  const html = await shown.text();
  assert.match(html, /<form method="post"/);
  assert.equal(subs[0].status, "ACTIVE", "opening the link doesn't unsubscribe (link scanners)");

  const done = await route.POST(req(url));
  assert.equal(done.status, 200);
  assert.match(await done.text(), /You(&#39;|')re unsubscribed/);
  assert.equal(subs[0].status, "UNSUBSCRIBED");
  assert.ok(subs[0].unsubscribedAt);

  await queuePostNewsletter(POST_1);
  await processNewsletterCampaigns();
  assert.deepEqual(allRecipients(), ["person1@example.com"]);
});

test("unsubscribe with a bad token changes nothing", async () => {
  addSubs(1);
  const res = await route.POST(req("https://tbj.example/api/newsletter/unsubscribe?s=sub_00000&t=wrong"));
  assert.equal(res.status, 400);
  assert.equal(subs[0].status, "ACTIVE");
  // The admin test email's link points at no subscriber.
  assert.equal((await route.GET(req("https://tbj.example/api/newsletter/unsubscribe?s=test"))).status, 400);
});
