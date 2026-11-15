// Run with: npm test
//
// Drives replyToLead (app/(admin)/actions/forms.ts) through the real
// lib/email.ts, with a fake database and a fake fetch standing in for Resend,
// so the test sees the exact request that would be sent.
import { test, mock, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

type Lead = { id: string; name: string; email: string; message: string; createdAt: Date; isRead: boolean };
type Reply = Record<string, unknown> & { leadId: string; body: string; createdAt: Date };

let leads: Lead[] = [];
let replies: Reply[] = [];
let siteEmail: string | null = "hello@tbj.example";
let permissionDenied = false;
let failReplyCreate = false;
const emailLog: Array<{ type: string; to: string; success: boolean }> = [];
const auditEntries: Array<Record<string, unknown>> = [];
const resendRequests: Array<Record<string, unknown>> = [];
let resendStatus = 200;

class AuthError extends Error {}

const fakePrisma = {
  formSubmission: {
    async findUnique({ where }: { where: { id: string } }) {
      return leads.find((l) => l.id === where.id) ?? null;
    },
    async update({ where, data }: { where: { id: string }; data: Partial<Lead> }) {
      const lead = leads.find((l) => l.id === where.id)!;
      Object.assign(lead, data);
      return lead;
    },
  },
  siteSetting: {
    async findFirst() {
      return { email: siteEmail };
    },
  },
  leadReply: {
    async findFirst({ where }: { where: { leadId: string; body: string; createdAt: { gte: Date } } }) {
      return replies.find((r) => r.leadId === where.leadId && r.body === where.body && r.createdAt >= where.createdAt.gte) ?? null;
    },
    async create({ data }: { data: Reply }) {
      if (failReplyCreate) throw new Error("db down");
      const row: Reply = { ...data, id: `r${replies.length + 1}`, createdAt: new Date() };
      replies.push(row);
      return row;
    },
  },
  emailLog: {
    async create({ data }: { data: { type: string; to: string; success: boolean } }) {
      emailLog.push(data);
    },
  },
};

const session = { user: { id: "admin_1", name: "Asha Rahman", email: "asha@tbj.example", role: "ADMIN" } };

mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma }, defaultExport: fakePrisma });
mock.module("@/lib/auth-guard", {
  namedExports: {
    AuthError,
    requirePermission: async (permission: string) => {
      assert.equal(permission, "USER_MANAGEMENT");
      if (permissionDenied) throw new AuthError("Missing required permission: USER_MANAGEMENT");
      return session;
    },
  },
});
mock.module("@/lib/audit-log", { namedExports: { logAudit: async (entry: Record<string, unknown>) => void auditEntries.push(entry) } });
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (_url: string, init: { body: string }) => {
  resendRequests.push(JSON.parse(init.body));
  return new Response(resendStatus === 200 ? "{}" : "bad request", { status: resendStatus });
}) as typeof fetch;

const { replyToLead } = await import("../app/(admin)/actions/forms");
const { withDisplayName, buildLeadReplyEmail } = await import("../lib/email");

beforeEach(() => {
  leads = [{ id: "lead_1", name: "Sam Lee", email: "sam@client.example", message: "Do you do <b>SEO</b>?\nThanks", createdAt: new Date("2026-11-10T09:30:00Z"), isRead: false }];
  replies = [];
  siteEmail = "hello@tbj.example";
  permissionDenied = false;
  failReplyCreate = false;
  resendStatus = 200;
  emailLog.length = 0;
  auditEntries.length = 0;
  resendRequests.length = 0;
  process.env.RESEND_API_KEY = "test-key";
  process.env.RESEND_FROM_EMAIL = "TBJ Growth <noreply@tbj.example>";
});

after(() => {
  globalThis.fetch = originalFetch;
});

test("sends to the lead with Reply-To set to the Site Settings inbox, signed by the admin", async () => {
  const result = await replyToLead({ leadId: "lead_1", body: "Hi Sam,\nYes we do." });
  assert.equal(result.success, true);

  assert.equal(resendRequests.length, 1);
  const req = resendRequests[0];
  assert.deepEqual(req.to, ["sam@client.example"]);
  assert.equal(req.reply_to, "hello@tbj.example");
  assert.equal(req.from, '"Asha Rahman at TBJ Growth" <noreply@tbj.example>');
  assert.equal(req.subject, "Re: Your message to TBJ Growth");
  assert.match(String(req.text), /^Hi Sam,\nYes we do\.\n\nAsha Rahman\nTBJ Growth\n\nOn .*, Sam Lee wrote:\n> Do you do <b>SEO<\/b>\?\n> Thanks\n$/);
  // The lead's own text is escaped in the HTML version.
  assert.ok(String(req.html).includes("Do you do &lt;b&gt;SEO&lt;/b&gt;?<br/>Thanks"));
});

test("saves the reply to the history, marks the lead read and logs it", async () => {
  await replyToLead({ leadId: "lead_1", body: "Thanks!" });
  assert.equal(replies.length, 1);
  assert.equal(replies[0].body, "Thanks!");
  assert.equal(replies[0].toEmail, "sam@client.example");
  assert.equal(replies[0].sentById, "admin_1");
  assert.equal(replies[0].sentByName, "Asha Rahman");
  assert.equal(leads[0].isRead, true);
  assert.deepEqual(emailLog, [{ type: "lead-reply", to: "sam@client.example", success: true, error: null }]);
  assert.equal(auditEntries[0].action, "reply");
});

test("refuses without USER_MANAGEMENT and sends nothing", async () => {
  permissionDenied = true;
  const result = await replyToLead({ leadId: "lead_1", body: "Hi" });
  assert.equal(result.success, false);
  assert.equal(resendRequests.length, 0);
  assert.equal(replies.length, 0);
});

test("blocks sending when Site Settings has no email", async () => {
  siteEmail = "  ";
  const result = await replyToLead({ leadId: "lead_1", body: "Hi" });
  assert.equal(result.success, false);
  assert.match(String(!result.success && result.error), /Site Settings/);
  assert.equal(resendRequests.length, 0);
});

test("a failed send saves nothing", async () => {
  resendStatus = 422;
  const result = await replyToLead({ leadId: "lead_1", body: "Hi" });
  assert.equal(result.success, false);
  assert.equal(replies.length, 0);
  assert.equal(leads[0].isRead, false);
});

test("missing RESEND_API_KEY is reported and nothing is sent", async () => {
  delete process.env.RESEND_API_KEY;
  const result = await replyToLead({ leadId: "lead_1", body: "Hi" });
  assert.equal(result.success, false);
  assert.match(String(!result.success && result.error), /RESEND_API_KEY/);
  assert.equal(resendRequests.length, 0);
});

test("the same reply twice in a row is only sent once", async () => {
  await replyToLead({ leadId: "lead_1", body: "Hi" });
  const second = await replyToLead({ leadId: "lead_1", body: "Hi" });
  assert.equal(second.success, false);
  assert.equal(resendRequests.length, 1);
  // A different reply goes out.
  assert.equal((await replyToLead({ leadId: "lead_1", body: "One more thing" })).success, true);
  assert.equal(resendRequests.length, 2);
});

test("empty, oversized or unknown-lead replies are rejected", async () => {
  assert.equal((await replyToLead({ leadId: "lead_1", body: "   " })).success, false);
  assert.equal((await replyToLead({ leadId: "lead_1", body: "x".repeat(10001) })).success, false);
  assert.equal((await replyToLead({ leadId: "nope", body: "Hi" })).success, false);
  assert.equal((await replyToLead(null)).success, false);
  assert.equal(resendRequests.length, 0);
});

test("an emailed reply that fails to save still reports success, with a warning", async () => {
  failReplyCreate = true;
  const result = await replyToLead({ leadId: "lead_1", body: "Hi" });
  assert.equal(result.success, true);
  assert.ok("warning" in result && result.warning);
  assert.equal(resendRequests.length, 1);
});

test("withDisplayName keeps the address and strips characters that could break the header", () => {
  assert.equal(withDisplayName("TBJ Growth <noreply@tbj.example>", "Asha"), '"Asha" <noreply@tbj.example>');
  assert.equal(withDisplayName("noreply@tbj.example", "Asha"), '"Asha" <noreply@tbj.example>');
  assert.equal(withDisplayName("noreply@tbj.example", 'Evil"\r\nBcc: x@y <z>'), '"Evil Bcc: x@y z" <noreply@tbj.example>');
  assert.equal(withDisplayName("noreply@tbj.example", '""'), "noreply@tbj.example");
});

test("an admin without a name signs as the team", () => {
  const email = buildLeadReplyEmail({
    to: "a@b.example",
    replyTo: "hello@tbj.example",
    subject: "s",
    body: "Hello",
    senderName: null,
    original: { name: "A", message: "m", createdAt: new Date("2026-11-10T09:30:00Z") },
  });
  assert.equal(email.fromName, "TBJ Growth");
  assert.match(email.text, /^Hello\n\nThe TBJ Growth team\n/);
});
