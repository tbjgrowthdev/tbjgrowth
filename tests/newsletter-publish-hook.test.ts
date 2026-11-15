// Run with: npm test
//
// The two ways a post gets published, manual (lib/workflow.ts
// transitionContent) and scheduled (lib/scheduled-jobs.ts processDueJobs),
// must both queue the newsletter on a post's first-ever publish, and only
// then. The newsletter module itself is faked here; its own behaviour is
// covered in newsletter-campaigns.test.ts.
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

type Item = { id: string; slug: string; title: string; status: string; publishedAt: Date | null; isIndexable: boolean };
const tables: Record<string, Map<string, Item>> = { post: new Map(), page: new Map(), caseStudy: new Map() };
type Job = { id: string; contentType: string; contentId: string; jobType: string; status: string; runAt: Date; attempts: number; payload: string | null; createdById: string; createdByName: string; createdByEmail: string };
let jobs: Job[] = [];
const queued: Array<{ id: string; title: string; slug: string }> = [];

function delegate(name: string) {
  return {
    async findUnique({ where }: { where: { id: string } }) {
      const row = tables[name].get(where.id);
      return row ? { ...row } : null;
    },
    async update({ where, data }: { where: { id: string }; data: Partial<Item> }) {
      const row = tables[name].get(where.id)!;
      Object.assign(row, data);
      return { ...row };
    },
  };
}

const fakePrisma = {
  post: delegate("post"),
  page: delegate("page"),
  caseStudy: delegate("caseStudy"),
  approvalHistory: { async create() {} },
  scheduledJob: {
    async findMany({ where }: { where: { status: string } }) {
      return jobs.filter((j) => j.status === where.status && j.runAt <= new Date()).map((j) => ({ ...j }));
    },
    async findUnique({ where }: { where: { id: string } }) {
      const j = jobs.find((x) => x.id === where.id);
      return j ? { ...j } : null;
    },
    async update({ where, data }: { where: { id: string; status?: string }; data: Record<string, unknown> }) {
      const j = jobs.find((x) => x.id === where.id && (!where.status || x.status === where.status));
      if (!j) throw Object.assign(new Error("not found"), { code: "P2025" });
      for (const [k, v] of Object.entries(data)) {
        (j as Record<string, unknown>)[k] = v && typeof v === "object" && "increment" in v ? (j as unknown as Record<string, number>)[k] + (v as { increment: number }).increment : v;
      }
      return { ...j };
    },
    async updateMany() {
      throw new Error("updateMany is not supported by the Neon HTTP adapter");
    },
  },
};

class AuthError extends Error {}
const session = { user: { id: "u1", role: "SUPER_ADMIN", name: "Admin", email: "admin@tbj.example" } };

mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma }, defaultExport: fakePrisma });
mock.module("@/lib/auth-guard", { namedExports: { AuthError, requirePermission: async () => session, requireSession: async () => session } });
mock.module("@/lib/revalidate", { namedExports: { revalidatePath: () => {} } });
mock.module("@/lib/audit-log", { namedExports: { logAudit: async () => {} } });
mock.module("@/lib/search-engine-ping", { namedExports: { notifySearchEnginesOfUrl: async () => {} } });
mock.module("@/lib/sitemap", { namedExports: { PUBLIC_PATH_BUILDERS: { POST: (s: string) => `/blog/${s}`, PAGE: (s: string) => `/${s}`, CASE_STUDY: (s: string) => `/case-studies/${s}` } } });
mock.module("@/lib/automation/engine", { namedExports: { fireAutomationEvent: async () => {} } });
mock.module("@/lib/newsletter-campaigns", { namedExports: { queuePostNewsletter: async (post: { id: string; title: string; slug: string }) => void queued.push(post) } });
mock.module("@/lib/email", { namedExports: { sendScheduledJobFailureNotification: async () => {} } });
mock.module("@/lib/versioning", { namedExports: { recordVersion: async () => {} } });
mock.module("@/lib/content-relations", { namedExports: { syncTaxonomy: async () => {} } });
mock.module("@/lib/blocks/schema", { namedExports: { normalizeBlocksInput: (x: unknown) => x } });
mock.module("@/lib/sanitize", { namedExports: { sanitizeRichText: (x: string) => x } });

const { transitionContent } = await import("../lib/workflow");
const { processDueJobs } = await import("../lib/scheduled-jobs");

function addPost(id: string, extra: Partial<Item> = {}) {
  tables.post.set(id, { id, slug: `${id}-slug`, title: `Title ${id}`, status: "APPROVED", publishedAt: null, isIndexable: true, ...extra });
}

beforeEach(() => {
  for (const t of Object.values(tables)) t.clear();
  jobs = [];
  queued.length = 0;
});

test("manual publish: first-ever publish queues the newsletter", async () => {
  addPost("p1");
  const result = await transitionContent("POST", "p1", "publish");
  assert.equal(result.success, true);
  assert.deepEqual(queued, [{ id: "p1", title: "Title p1", slug: "p1-slug" }]);
});

test("manual: unpublishing and republishing never queues again", async () => {
  addPost("p1");
  await transitionContent("POST", "p1", "publish");
  await transitionContent("POST", "p1", "unpublish");
  await transitionContent("POST", "p1", "publish");
  assert.equal(queued.length, 1);
});

test("manual: a post that went live before (publishedAt set) never queues", async () => {
  addPost("old", { status: "DRAFT", publishedAt: new Date("2025-01-01") });
  await transitionContent("POST", "old", "publish");
  assert.equal(queued.length, 0);
});

test("manual: pages and case studies never queue", async () => {
  tables.page.set("pg", { id: "pg", slug: "about", title: "About", status: "APPROVED", publishedAt: null, isIndexable: true });
  await transitionContent("PAGE", "pg", "publish");
  assert.equal(queued.length, 0);
});

function addJob(contentId: string, jobType = "PUBLISH", contentType = "POST") {
  jobs.push({ id: `job_${jobs.length + 1}`, contentType, contentId, jobType, status: "PENDING", runAt: new Date(Date.now() - 1000), attempts: 0, payload: null, createdById: "u1", createdByName: "Admin", createdByEmail: "admin@tbj.example" });
}

test("scheduled publish: runs (no updateMany) and queues the newsletter on first-ever publish", async () => {
  addPost("p2", { status: "SCHEDULED" });
  addJob("p2");
  const results = await processDueJobs();
  assert.deepEqual(results, [{ id: "job_1", success: true }]);
  assert.equal(tables.post.get("p2")!.status, "PUBLISHED");
  assert.equal(jobs[0].status, "COMPLETED");
  assert.deepEqual(queued, [{ id: "p2", title: "Title p2", slug: "p2-slug" }]);
});

test("scheduled: a republish of a post that was live before doesn't queue", async () => {
  addPost("p3", { status: "DRAFT", publishedAt: new Date("2026-01-01") });
  addJob("p3");
  await processDueJobs();
  assert.equal(tables.post.get("p3")!.status, "PUBLISHED");
  assert.equal(queued.length, 0);
});

test("scheduled: a job already claimed by another run is skipped", async () => {
  addPost("p4", { status: "SCHEDULED" });
  addJob("p4");
  // Simulate the other run claiming it between the read and the claim.
  const original = fakePrisma.scheduledJob.findMany;
  fakePrisma.scheduledJob.findMany = async (args) => {
    const rows = await original(args);
    jobs[0].status = "PROCESSING";
    return rows;
  };
  try {
    const results = await processDueJobs();
    assert.deepEqual(results, [{ id: "job_1", skipped: true }]);
    assert.equal(tables.post.get("p4")!.status, "SCHEDULED");
    assert.equal(queued.length, 0);
  } finally {
    fakePrisma.scheduledJob.findMany = original;
  }
});
