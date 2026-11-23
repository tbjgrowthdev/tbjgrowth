// Run with: npm test
//
// lib/push/notify.ts and the three places that trigger it: the public contact
// form, the public booking form, and a content submission for review. FCM and
// the recipient lookup are faked; `after()` runs its callback immediately.
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

type Sent = { tokens: string[]; msg: { title: string; body: string; url: string } };

let tokensFor: Record<string, string[]> = {};
let fcmThrows = false;
let recipientsThrow = false;
let invalid: string[] = [];
const sent: Sent[] = [];
const deleted: unknown[] = [];
const afterCallbacks: Array<() => unknown> = [];

class AuthError extends Error {}

// --- fake database -------------------------------------------------------
let submissions: Array<Record<string, unknown>> = [];
let bookings: Array<Record<string, unknown>> = [];
let post: Record<string, unknown> = {};
const fakePrisma = {
  pushDevice: {
    async deleteMany(args: unknown) {
      deleted.push(args);
      return { count: 1 };
    },
  },
  formSubmission: {
    async count() {
      return 0;
    },
    async create({ data }: { data: Record<string, unknown> }) {
      const row = { ...data, id: `lead_${submissions.length + 1}`, createdAt: new Date() };
      submissions.push(row);
      return row;
    },
  },
  siteSetting: {
    async findFirst() {
      return { email: "hello@tbj.example" };
    },
  },
  booking: {
    async count() {
      return 0;
    },
    async create({ data }: { data: Record<string, unknown> }) {
      const row = { ...data, id: `b_${bookings.length + 1}` };
      bookings.push(row);
      return row;
    },
  },
  availableSlot: {
    async findUnique() {
      return { id: "slot_1", isBooked: false, startsAt: new Date(Date.now() + 86_400_000), duration: 30 };
    },
    async update() {
      return {};
    },
  },
  post: {
    async findUnique() {
      return { ...post };
    },
    async update({ data }: { data: Record<string, unknown> }) {
      Object.assign(post, data);
      return { ...post };
    },
  },
  page: {},
  caseStudy: {},
  approvalHistory: {
    async create() {
      return {};
    },
  },
};

mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma }, defaultExport: fakePrisma });
mock.module("@/lib/push/recipients", {
  namedExports: {
    recipientTokens: async (event: string) => {
      if (recipientsThrow) throw new Error("db down");
      return tokensFor[event] ?? [];
    },
    staffUserTokens: async () => [],
  },
});
mock.module("@/lib/push/fcm", {
  namedExports: {
    sendFcm: async (tokens: string[], msg: Sent["msg"]) => {
      if (fcmThrows) throw new Error("FCM unreachable");
      sent.push({ tokens, msg });
      return { sent: tokens.length - invalid.length, invalidTokens: invalid };
    },
  },
});
mock.module("next/server", { namedExports: { after: (cb: () => unknown) => void afterCallbacks.push(cb) } });
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });
mock.module("@/lib/revalidate", { namedExports: { revalidatePath: () => {} } });
mock.module("@/lib/email", {
  namedExports: {
    BRAND_NAME: "TBJ Growth",
    sendContactNotification: async () => {},
    sendLeadReply: async () => ({ success: true }),
    sendBookingNotification: async () => {},
  },
});
mock.module("@/lib/auth-guard", {
  namedExports: {
    AuthError,
    requireSession: async () => ({ user: { id: "u_author", role: "CONTRIBUTOR" } }),
    requirePermission: async () => ({ user: { id: "u_author", role: "CONTRIBUTOR" } }),
  },
});
mock.module("@/lib/audit-log", { namedExports: { logAudit: async () => {} } });
mock.module("@/lib/search-engine-ping", { namedExports: { notifySearchEnginesOfUrl: async () => {} } });
mock.module("@/lib/sitemap", { namedExports: { PUBLIC_PATH_BUILDERS: { POST: (s: string) => `/blog/${s}`, PAGE: (s: string) => `/${s}`, CASE_STUDY: (s: string) => `/case-studies/${s}` } } });
mock.module("@/lib/automation/engine", { namedExports: { fireAutomationEvent: async () => {} } });
mock.module("@/lib/newsletter-campaigns", { namedExports: { queuePostNewsletter: async () => {} } });

const { notifyAdmins } = await import("@/lib/push/notify");
const { submitContactForm } = await import("../app/(admin)/actions/forms");
const { createBooking } = await import("../app/(admin)/actions/booking");
const { transitionContent } = await import("@/lib/workflow");

async function flushAfter() {
  while (afterCallbacks.length) await afterCallbacks.shift()!();
}

beforeEach(() => {
  tokensFor = { NEW_LEAD: ["t-admin"], NEW_BOOKING: ["t-admin", "t-editor"], CONTENT_AWAITING_APPROVAL: ["t-editor"] };
  fcmThrows = false;
  recipientsThrow = false;
  invalid = [];
  sent.length = 0;
  deleted.length = 0;
  afterCallbacks.length = 0;
  submissions = [];
  bookings = [];
  post = { id: "p1", slug: "hello", title: "Hello", status: "DRAFT", authorId: "u_author", publishedAt: null };
});

test("notifyAdmins swallows FCM errors", async () => {
  fcmThrows = true;
  await assert.doesNotReject(notifyAdmins("NEW_LEAD"));
});

test("notifyAdmins swallows recipient lookup errors", async () => {
  recipientsThrow = true;
  await assert.doesNotReject(notifyAdmins("NEW_LEAD"));
});

test("invalid tokens are deleted", async () => {
  invalid = ["t-editor"];
  await notifyAdmins("NEW_BOOKING");
  assert.deepEqual(deleted, [{ where: { token: { in: ["t-editor"] } } }]);
});

test("no recipients means no FCM call", async () => {
  tokensFor = {};
  await notifyAdmins("NEW_LEAD");
  assert.equal(sent.length, 0);
});

test("lead is saved and success returned when FCM throws", async () => {
  fcmThrows = true;
  const result = await submitContactForm({ name: "Sam Lee", email: "sam@client.example", message: "Hi there" });
  assert.deepEqual(result, { success: true });
  assert.equal(submissions.length, 1);
  await assert.doesNotReject(flushAfter());
});

test("a new lead pushes NEW_LEAD with no personal data", async () => {
  await submitContactForm({ name: "Sam Lee", email: "sam@client.example", phone: "+8801700000000", message: "Secret project" });
  assert.equal(sent.length, 0, "push runs after the response, not before");
  await flushAfter();
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].tokens, ["t-admin"]);
  assert.equal(sent[0].msg.url, "/admin/leads");
  const text = JSON.stringify(sent[0].msg);
  for (const pii of ["Sam", "sam@client.example", "+8801700000000", "Secret"]) assert.ok(!text.includes(pii), pii);
});

test("booking triggers NEW_BOOKING", async () => {
  const result = await createBooking({ slotId: "slot_1", name: "Ana", email: "ana@client.example" });
  assert.equal(result.success, true);
  await flushAfter();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].msg.title, "New call booked");
  assert.equal(sent[0].msg.url, "/admin/booking");
});

test("submit transition triggers CONTENT_AWAITING_APPROVAL linking to that item; approve does not", async () => {
  const submitted = await transitionContent("POST", "p1", "submit");
  assert.equal(submitted.success, true);
  await flushAfter();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].msg.title, "Content awaiting approval");
  assert.equal(sent[0].msg.url, "/admin/posts/p1");

  sent.length = 0;
  const approved = await transitionContent("POST", "p1", "approve");
  assert.equal(approved.success, true);
  await flushAfter();
  assert.equal(sent.length, 0);
});

test("resubmit after changes requested also notifies", async () => {
  post.status = "CHANGES_REQUESTED";
  await transitionContent("POST", "p1", "resubmit");
  await flushAfter();
  assert.equal(sent.length, 1);
});
