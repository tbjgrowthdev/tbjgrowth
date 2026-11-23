// Run with: npm test
//
// Admin client projects (app/(admin)/actions/client-projects.ts and
// lib/clients/updates.ts): projects, milestones, updates, approval requests,
// update reminders and the stale-project list.
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createFakePrisma, CLIENT_HUB_SCHEMA, type Row } from "./helpers/fake-prisma";
import { hasPermission, type Permission } from "@/lib/permissions";

let db = createFakePrisma(CLIENT_HUB_SCHEMA);
let role = "ADMIN";
let audits: Array<{ action: string; entityType: string; entityId?: string | null; before?: unknown; after?: unknown }> = [];
let pushes: Array<{ event: string; clientId: string }> = [];
let pushFails = false;
let clock = new Date("2026-11-23T10:00:00Z");
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const t = () => db._tables as Record<string, Row[]>;

// The two raw statements lib/clients/updates.ts may send (one atomic UPDATE
// each), whitespace-normalised with $n per bound value.
const COMPLETE_MILESTONE_SQL = 'UPDATE "ProjectMilestone" SET "doneAt" = $1 WHERE "id" = $2 AND "doneAt" IS NULL RETURNING "id", "projectId", "title"';
const CLAIM_NOTIFY_SQL = 'UPDATE "Project" SET "lastClientNotifyAt" = $1 WHERE "id" = $2 AND ("lastClientNotifyAt" IS NULL OR "lastClientNotifyAt" <= $3) RETURNING "id"';

async function queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
  const sql = strings.reduce((acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""), "").replace(/\s+/g, " ").trim();
  if (sql === COMPLETE_MILESTONE_SQL) {
    const [at, id] = values as [Date, string];
    const m = t().projectMilestone.find((x) => x.id === id && x.doneAt == null);
    if (!m) return [];
    m.doneAt = at;
    return [{ id: m.id, projectId: m.projectId, title: m.title }];
  }
  if (sql === CLAIM_NOTIFY_SQL) {
    const [at, id, cutoff] = values as [Date, string, Date];
    const p = t().project.find((x) => x.id === id && (x.lastClientNotifyAt == null || x.lastClientNotifyAt <= cutoff));
    if (!p) return [];
    p.lastClientNotifyAt = at;
    return [{ id: p.id }];
  }
  throw new Error(`unexpected raw SQL: ${sql}`);
}

const proxy = new Proxy({}, { get: (_t, k) => (k === "$queryRaw" ? queryRaw : (db as Row)[k as string]) });

class AuthError extends Error {}
mock.module("@/lib/prisma", { namedExports: { prisma: proxy }, defaultExport: proxy });
mock.module("@/lib/auth-guard", {
  namedExports: {
    AuthError,
    requireSession: async () => ({ user: { id: "staff_admin", role, sessionId: "s1" } }),
    requirePermission: async (p: Permission) => {
      if (!hasPermission(role as never, p)) throw new AuthError(`Missing required permission: ${p}`);
      return { user: { id: role === "EDITOR" ? "staff_editor" : "staff_admin", role, sessionId: "s1" } };
    },
  },
});
mock.module("@/lib/audit-log", { namedExports: { logAudit: async (p: (typeof audits)[number]) => void audits.push(p) } });
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });
mock.module("@/lib/push/client-notify", {
  namedExports: {
    notifyClients: async (event: string, clientId: string) => {
      if (pushFails) throw new Error("FCM down");
      pushes.push({ event, clientId });
    },
  },
});
mock.module("@/lib/clients/clock", { namedExports: { now: () => new Date(clock) } });

const actions = await import("../app/(admin)/actions/client-projects");
const updates = await import("@/lib/clients/updates");
const portal = await import("@/lib/portal/data");

beforeEach(() => {
  db = createFakePrisma(CLIENT_HUB_SCHEMA);
  role = "ADMIN";
  audits = [];
  pushes = [];
  pushFails = false;
  clock = new Date("2026-11-23T10:00:00Z");
  t().user.push({ id: "staff_admin", name: "Ana", email: "ana@tbj.test", role: "ADMIN" });
  t().user.push({ id: "staff_editor", name: "Eli", email: "eli@tbj.test", role: "EDITOR" });
  t().client.push({ id: "client_a", name: "Acme", accountManagerId: "staff_admin", createdAt: new Date(clock.getTime() - 60 * DAY) });
  t().clientUser.push({ id: "cu_a", clientId: "client_a", email: "a@acme.test", name: "A", language: "en", status: "ACTIVE" });
  addProject("proj_1");
});

function addProject(id: string, over: Row = {}) {
  t().project.push({
    id,
    clientId: "client_a",
    title: `Project ${id}`,
    description: null,
    status: "IN_PROGRESS",
    progress: 10,
    startDate: null,
    dueDate: null,
    updateIntervalDays: null,
    lastUpdateNudgeAt: null,
    lastClientNotifyAt: null,
    createdAt: new Date(clock.getTime() - 30 * DAY),
    ...over,
  });
}
function addUpdateAt(projectId: string, daysAgo: number) {
  t().projectUpdate.push({ id: `u_${projectId}_${daysAgo}`, projectId, authorId: "staff_admin", kind: "MANUAL", body: "x", internalNote: null, createdAt: new Date(clock.getTime() - daysAgo * DAY) });
}

// ---- permissions ----

test("EDITOR can post updates but cannot create or delete projects", async () => {
  role = "EDITOR";
  assert.equal((await actions.postProjectUpdate("proj_1", { body: "Work started" })).success, true);
  assert.equal((await actions.createProject("client_a", { title: "New site" })).success, false);
  assert.equal((await actions.deleteProject("proj_1")).success, false);
  assert.equal(t().project.length, 1);
  assert.equal(t().projectUpdate.length, 1);
  assert.equal(t().projectUpdate[0].authorId, "staff_editor");
});

test("SEO_MANAGER and CONTRIBUTOR can't post updates", async () => {
  for (const r of ["SEO_MANAGER", "CONTRIBUTOR"]) {
    role = r;
    assert.equal((await actions.postProjectUpdate("proj_1", { body: "hi" })).success, false);
  }
  assert.equal(t().projectUpdate.length, 0);
});

test("ADMIN creates, edits and deletes a project, each audit-logged", async () => {
  const created = await actions.createProject("client_a", { title: "  Shop  ", progress: 0, status: "NOT_STARTED" });
  assert.equal(created.success, true);
  const id = (created as { id: string }).id;
  assert.equal(t().project.find((p) => p.id === id)!.title, "Shop");
  assert.equal((await actions.updateProject(id, { title: "Shop v2", progress: 50, status: "IN_PROGRESS" })).success, true);
  assert.equal(t().project.find((p) => p.id === id)!.progress, 50);
  assert.equal((await actions.deleteProject(id)).success, true);
  assert.equal(t().project.some((p) => p.id === id), false);
  assert.deepEqual(audits.map((a) => a.action), ["create", "update", "delete"]);
});

test("project progress must be 0–100 and the client must exist", async () => {
  assert.equal((await actions.createProject("client_a", { title: "X", progress: 101 })).success, false);
  assert.equal((await actions.createProject("nope", { title: "X" })).success, false);
});

// ---- updates ----

test("internal notes are stored but never selected by portal queries", async () => {
  await actions.postProjectUpdate("proj_1", { body: "Design ready", internalNote: "STAFF-ONLY client is slow to pay" });
  assert.equal(t().projectUpdate[0].internalNote, "STAFF-ONLY client is slow to pay");
  const ctx = { clientUserId: "cu_a", clientId: "client_a", sessionId: "s", language: "en" as const };
  const seen = JSON.stringify([await portal.getProject(ctx, "proj_1"), await portal.listRecentUpdates(ctx, 10)]);
  assert.ok(seen.includes("Design ready"));
  assert.equal(seen.includes("STAFF-ONLY"), false);
});

test("quick-post notifies the client by default", async () => {
  await actions.postProjectUpdate("proj_1", { body: "Staging link ready" });
  assert.deepEqual(pushes, [{ event: "CLIENT_PROJECT_UPDATE", clientId: "client_a" }]);
});

test("quick-post with notify off stores the update without a push", async () => {
  assert.equal((await actions.postProjectUpdate("proj_1", { body: "Small fix", notify: false })).success, true);
  assert.equal(t().projectUpdate.length, 1);
  assert.deepEqual(pushes, []);
});

test("quick-post can change the project status in the same step", async () => {
  await actions.postProjectUpdate("proj_1", { body: "Delivered", status: "COMPLETED" });
  assert.equal(t().project[0].status, "COMPLETED");
});

test("an empty update body is rejected", async () => {
  assert.equal((await actions.postProjectUpdate("proj_1", { body: "   " })).success, false);
  assert.equal(t().projectUpdate.length, 0);
});

test("push failure never breaks posting an update", async () => {
  pushFails = true;
  assert.equal((await actions.postProjectUpdate("proj_1", { body: "Still saved" })).success, true);
  assert.equal(t().projectUpdate.length, 1);
});

test("templates are a fixed list with English and Bangla text", () => {
  assert.ok(updates.UPDATE_TEMPLATES.length >= 4);
  for (const tpl of updates.UPDATE_TEMPLATES) assert.ok(tpl.en.length > 0 && tpl.bn.length > 0, tpl.id);
});

// ---- milestones ----

test("completing a milestone creates one MILESTONE update", async () => {
  await actions.addMilestone("proj_1", { title: "Homepage design" });
  const ms = t().projectMilestone[0];
  assert.equal((await actions.setMilestoneDone(ms.id, true)).success, true);
  assert.equal((await actions.setMilestoneDone(ms.id, true)).success, true); // second click: no second update
  const sys = t().projectUpdate.filter((u) => u.kind === "MILESTONE");
  assert.equal(sys.length, 1);
  assert.equal(sys[0].body, "Milestone completed: Homepage design");
  assert.equal(sys[0].authorId, null);
});

test("rapid milestone completions notify the client once per hour", async () => {
  for (const title of ["One", "Two", "Three"]) await actions.addMilestone("proj_1", { title });
  for (const m of [...t().projectMilestone]) await actions.setMilestoneDone(m.id, true);
  assert.equal(t().projectUpdate.filter((u) => u.kind === "MILESTONE").length, 3);
  assert.equal(pushes.length, 1);
  clock = new Date(clock.getTime() + 61 * MIN);
  await actions.addMilestone("proj_1", { title: "Four" });
  await actions.setMilestoneDone(t().projectMilestone[3].id, true);
  assert.equal(pushes.length, 2);
});

test("completing all milestones does not auto-complete the project", async () => {
  await actions.addMilestone("proj_1", { title: "Only one" });
  await actions.setMilestoneDone(t().projectMilestone[0].id, true);
  assert.equal(t().project[0].status, "IN_PROGRESS");
});

test("un-completing a milestone clears it without posting an update", async () => {
  await actions.addMilestone("proj_1", { title: "M" });
  const id = t().projectMilestone[0].id;
  await actions.setMilestoneDone(id, true);
  await actions.setMilestoneDone(id, false);
  assert.equal(t().projectMilestone[0].doneAt, null);
  assert.equal(t().projectUpdate.length, 1);
});

// ---- approvals ----

test("approval request starts PENDING and sets the project to WAITING_ON_CLIENT", async () => {
  const r = await actions.createApprovalRequest("proj_1", { title: "Homepage design", description: "Figma link inside" });
  assert.equal(r.success, true);
  const a = t().approvalRequest[0];
  assert.equal(a.status, "PENDING");
  assert.equal(t().project[0].status, "WAITING_ON_CLIENT");
  const sys = t().projectUpdate.filter((u) => u.kind === "APPROVAL");
  assert.equal(sys.length, 1);
  assert.equal(sys[0].body, "Approval requested: Homepage design");
  assert.deepEqual(pushes, [{ event: "CLIENT_APPROVAL_NEEDED", clientId: "client_a" }]);
});

test("EDITOR can't create approval requests", async () => {
  role = "EDITOR";
  assert.equal((await actions.createApprovalRequest("proj_1", { title: "X" })).success, false);
  assert.equal(t().approvalRequest.length, 0);
});

// ---- update reminders ----

test("stale list contains only active projects with no update within their interval", async () => {
  addProject("proj_fresh");
  addUpdateAt("proj_fresh", 2);
  addProject("proj_stale_old_update");
  addUpdateAt("proj_stale_old_update", 9);
  addProject("proj_done", { status: "COMPLETED" });
  addProject("proj_not_started", { status: "NOT_STARTED" });
  addProject("proj_waiting", { status: "WAITING_ON_CLIENT" });
  addUpdateAt("proj_waiting", 8);
  addProject("proj_new", { createdAt: new Date(clock.getTime() - 3 * DAY) });
  // proj_1 (created 30 days ago, never updated) is stale too.
  const stale = (await updates.findStaleProjects(clock)).map((p) => p.id).sort();
  assert.deepEqual(stale, ["proj_1", "proj_stale_old_update", "proj_waiting"]);
});

test("per-project interval overrides the global default", async () => {
  t().project[0].updateIntervalDays = 3;
  addUpdateAt("proj_1", 4);
  addProject("proj_slow", { updateIntervalDays: 14 });
  addUpdateAt("proj_slow", 9);
  const stale = (await updates.findStaleProjects(clock)).map((p) => p.id);
  assert.deepEqual(stale, ["proj_1"]);
  assert.equal(updates.getUpdateIntervalDays({ updateIntervalDays: 3 }, { updateReminderDays: 7 }), 3);
  assert.equal(updates.getUpdateIntervalDays({ updateIntervalDays: null }, { updateReminderDays: 7 }), 7);
});

test("interval 0 disables the stale list and nudges for that scope", async () => {
  t().project[0].updateIntervalDays = 0;
  assert.deepEqual(await updates.findStaleProjects(clock), []);
  t().project[0].updateIntervalDays = null;
  t().clientHubSetting.push({ id: "global", updateReminderDays: 0 });
  assert.deepEqual(await updates.findStaleProjects(clock), []);
  t().project[0].updateIntervalDays = 5; // a project override still applies when the default is off
  assert.deepEqual((await updates.findStaleProjects(clock)).map((p) => p.id), ["proj_1"]);
});

test("interval outside 0–60 is rejected", async () => {
  for (const bad of [-1, 61, 2.5, Number.NaN]) {
    assert.equal((await actions.setUpdateReminderDays(bad)).success, false, String(bad));
    assert.equal((await actions.updateProject("proj_1", { title: "P", updateIntervalDays: bad })).success, false, String(bad));
  }
  assert.equal(t().clientHubSetting.length, 0);
  assert.equal(t().project[0].updateIntervalDays, null);
});

test("only CLIENT_MANAGEMENT can change the global interval, and the change is audit-logged", async () => {
  role = "EDITOR";
  assert.equal((await actions.setUpdateReminderDays(3)).success, false);
  assert.equal(t().clientHubSetting.length, 0);
  role = "ADMIN";
  assert.equal((await actions.setUpdateReminderDays(3)).success, true);
  assert.equal(t().clientHubSetting[0].updateReminderDays, 3);
  assert.equal((await actions.setUpdateReminderDays(10)).success, true);
  assert.equal(t().clientHubSetting.length, 1);
  assert.equal(t().clientHubSetting[0].updateReminderDays, 10);
  assert.deepEqual(
    audits.map((a) => [a.action, a.entityType, a.before, a.after]),
    [
      ["update", "ClientHubSetting", { updateReminderDays: 7 }, { updateReminderDays: 3 }],
      ["update", "ClientHubSetting", { updateReminderDays: 3 }, { updateReminderDays: 10 }],
    ]
  );
});

test("changing a project's interval is audit-logged", async () => {
  await actions.updateProject("proj_1", { title: "Project proj_1", updateIntervalDays: 14 });
  assert.equal(t().project[0].updateIntervalDays, 14);
  const a = audits.find((x) => x.entityType === "Project")!;
  assert.deepEqual([(a.before as Row).updateIntervalDays, (a.after as Row).updateIntervalDays], [null, 14]);
});

test("retrying an approval request after a part-way failure doesn't create a second approval", async () => {
  const orig = db.projectUpdate.create;
  let failOnce = true;
  db.projectUpdate.create = async (args: Row) => {
    if (failOnce) {
      failOnce = false;
      throw new Error("neon down");
    }
    return orig(args);
  };
  const first = await actions.createApprovalRequest("proj_1", { title: "Homepage design" });
  assert.equal(first.success, false);
  assert.equal(t().approvalRequest.length, 1); // the approval row was written before the failure
  const retry = await actions.createApprovalRequest("proj_1", { title: "Homepage design" });
  assert.equal(retry.success, true);
  assert.equal((retry as { id: string }).id, t().approvalRequest[0].id);
  assert.equal(t().approvalRequest.length, 1);
  assert.equal(t().projectUpdate.filter((u) => u.kind === "APPROVAL").length, 1);
  assert.equal(t().project[0].status, "WAITING_ON_CLIENT");
  assert.deepEqual(pushes, [{ event: "CLIENT_APPROVAL_NEEDED", clientId: "client_a" }]);
});

test("asking again for the same still-pending approval doesn't duplicate it or push again", async () => {
  await actions.createApprovalRequest("proj_1", { title: "Homepage design" });
  const again = await actions.createApprovalRequest("proj_1", { title: "  Homepage design " });
  assert.equal(again.success, true);
  assert.equal(t().approvalRequest.length, 1);
  assert.equal(t().projectUpdate.filter((u) => u.kind === "APPROVAL").length, 1);
  assert.equal(pushes.length, 1);
  // A different title, or the same title once answered, is a new request.
  await actions.createApprovalRequest("proj_1", { title: "Logo" });
  t().approvalRequest[0].status = "APPROVED";
  await actions.createApprovalRequest("proj_1", { title: "Homepage design" });
  assert.equal(t().approvalRequest.length, 3);
});
