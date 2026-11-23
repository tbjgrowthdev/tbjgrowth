// A small in-memory stand-in for the Prisma client, for tests that must check
// real query semantics (tenancy: where filters through relations; leakage:
// select). It implements the subset the Client Hub uses:
//
//   where:   scalar equality, { equals, in, notIn, not, lt, lte, gt, gte, contains },
//            AND / OR / NOT, to-one relation filters ({ ...where } or { is }),
//            to-many relation filters ({ some, none, every })
//   select:  scalars, nested to-one / to-many relations ({ select, where, orderBy, take })
//            Without select, every scalar column comes back, like Prisma, so a
//            query that forgets its select leaks staff-only columns in tests too.
//   ops:     findMany, findFirst, findUnique, count, create, update, delete, deleteMany
//
// update() honours extra non-unique filters in `where` and throws a P2025
// error when nothing matches, like Prisma. Nested writes are not supported
// (Neon HTTP can't run them either).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = any;

export type Relation = { model: string; kind: "one" | "many"; from: string; to: string };
export type Schema = Record<string, Record<string, Relation>>;

export class FakeP2025 extends Error {
  code = "P2025";
}
export class FakeP2002 extends Error {
  code = "P2002";
}

export function createFakePrisma(schema: Schema, opts: { unique?: Record<string, string[]> } = {}) {
  const tables: Record<string, Row[]> = {};
  for (const model of Object.keys(schema)) tables[model] = [];
  let seq = 0;

  const rel = (model: string, key: string): Relation | undefined => schema[model]?.[key];

  function related(model: string, row: Row, r: Relation): Row[] {
    return (tables[r.model] ?? []).filter((x) => x[r.to] !== undefined && row[r.from] !== undefined && x[r.to] === row[r.from] && row[r.from] !== null);
  }

  function matchScalar(value: unknown, cond: Q): boolean {
    if (cond === null || typeof cond !== "object" || cond instanceof Date) {
      return cond instanceof Date ? value instanceof Date && value.getTime() === cond.getTime() : value === cond;
    }
    const v = value instanceof Date ? value.getTime() : value;
    const n = (x: unknown) => (x instanceof Date ? x.getTime() : x);
    for (const [op, arg] of Object.entries(cond)) {
      switch (op) {
        case "equals":
          if (!matchScalar(value, arg)) return false;
          break;
        case "not":
          if (arg !== null && typeof arg === "object" && !(arg instanceof Date)) {
            if (matchScalar(value, arg)) return false;
          } else if (matchScalar(value, arg)) return false;
          break;
        case "in":
          if (!(arg as unknown[]).some((a) => n(a) === v)) return false;
          break;
        case "notIn":
          if ((arg as unknown[]).some((a) => n(a) === v)) return false;
          break;
        case "lt":
          if (!(v !== null && v !== undefined && (v as number) < (n(arg) as number))) return false;
          break;
        case "lte":
          if (!(v !== null && v !== undefined && (v as number) <= (n(arg) as number))) return false;
          break;
        case "gt":
          if (!(v !== null && v !== undefined && (v as number) > (n(arg) as number))) return false;
          break;
        case "gte":
          if (!(v !== null && v !== undefined && (v as number) >= (n(arg) as number))) return false;
          break;
        case "contains":
          if (typeof value !== "string" || !value.includes(arg as string)) return false;
          break;
        case "mode":
          break;
        default:
          throw new Error(`fake-prisma: unsupported operator ${op}`);
      }
    }
    return true;
  }

  function matches(model: string, row: Row, where: Q): boolean {
    if (!where) return true;
    for (const [key, cond] of Object.entries(where)) {
      if (cond === undefined) continue;
      if (key === "AND") {
        if (!(Array.isArray(cond) ? cond : [cond]).every((w) => matches(model, row, w))) return false;
        continue;
      }
      if (key === "OR") {
        if (!(cond as Q[]).some((w) => matches(model, row, w))) return false;
        continue;
      }
      if (key === "NOT") {
        if ((Array.isArray(cond) ? cond : [cond]).some((w) => matches(model, row, w))) return false;
        continue;
      }
      const r = rel(model, key);
      if (r) {
        const rows = related(model, row, r);
        if (r.kind === "one") {
          if (cond === null) {
            if (rows.length !== 0) return false;
            continue;
          }
          const inner = (cond as Q).is !== undefined ? (cond as Q).is : (cond as Q).isNot !== undefined ? null : cond;
          if ((cond as Q).isNot !== undefined) {
            if (rows.length > 0 && matches(r.model, rows[0], (cond as Q).isNot)) return false;
            continue;
          }
          if (inner === null) {
            if (rows.length !== 0) return false;
            continue;
          }
          if (rows.length === 0 || !matches(r.model, rows[0], inner)) return false;
        } else {
          const c = cond as Q;
          if (c.some && !rows.some((x) => matches(r.model, x, c.some))) return false;
          if (c.none && rows.some((x) => matches(r.model, x, c.none))) return false;
          if (c.every && !rows.every((x) => matches(r.model, x, c.every))) return false;
        }
        continue;
      }
      if (!matchScalar(row[key], cond)) return false;
    }
    return true;
  }

  function sort(rows: Row[], orderBy: Q): Row[] {
    if (!orderBy) return rows;
    const list = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...rows].sort((a, b) => {
      for (const o of list) {
        const [k, dirRaw] = Object.entries(o)[0] as [string, Q];
        const dir = typeof dirRaw === "object" ? dirRaw.sort : dirRaw;
        const av = a[k] instanceof Date ? a[k].getTime() : a[k];
        const bv = b[k] instanceof Date ? b[k].getTime() : b[k];
        if (av === bv) continue;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        return (av < bv ? -1 : 1) * (dir === "desc" ? -1 : 1);
      }
      return 0;
    });
  }

  function project(model: string, row: Row, select: Q, include?: Q): Row {
    if (!select) {
      const out: Row = {};
      for (const [k, v] of Object.entries(row)) if (!rel(model, k)) out[k] = v;
      if (include) Object.assign(out, project(model, row, Object.fromEntries(Object.entries(include).filter(([k]) => rel(model, k)))));
      return out;
    }
    const out: Row = {};
    for (const [k, v] of Object.entries(select)) {
      if (!v) continue;
      if (k === "_count") {
        const counts: Row = {};
        for (const [ck, cv] of Object.entries((v as Q).select ?? {})) {
          const r = rel(model, ck)!;
          counts[ck] = related(model, row, r).filter((x) => matches(r.model, x, typeof cv === "object" ? (cv as Q).where : undefined)).length;
        }
        out._count = counts;
        continue;
      }
      const r = rel(model, k);
      if (r) {
        const nested = v === true ? {} : (v as Q);
        let rows = related(model, row, r).filter((x) => matches(r.model, x, nested.where));
        if (r.kind === "one") {
          out[k] = rows[0] ? project(r.model, rows[0], nested.select, nested.include) : null;
        } else {
          rows = sort(rows, nested.orderBy);
          if (nested.take !== undefined) rows = rows.slice(0, nested.take);
          out[k] = rows.map((x) => project(r.model, x, nested.select, nested.include));
        }
      } else {
        out[k] = row[k];
      }
    }
    return out;
  }

  function checkUnique(model: string, row: Row, ignore?: Row) {
    for (const field of opts.unique?.[model] ?? []) {
      if (row[field] === undefined || row[field] === null) continue;
      if (tables[model].some((x) => x !== ignore && x[field] === row[field])) throw new FakeP2002(`Unique constraint failed on ${model}.${field}`);
    }
  }

  function delegate(model: string) {
    const rows = () => tables[model];
    return {
      async findMany(args: Q = {}) {
        let out = sort(rows().filter((r) => matches(model, r, args.where)), args.orderBy);
        if (args.skip) out = out.slice(args.skip);
        if (args.take !== undefined) out = out.slice(0, args.take);
        return out.map((r) => project(model, r, args.select, args.include));
      },
      async findFirst(args: Q = {}) {
        const r = sort(rows().filter((x) => matches(model, x, args.where)), args.orderBy)[0];
        return r ? project(model, r, args.select, args.include) : null;
      },
      async findUnique(args: Q) {
        const r = rows().find((x) => matches(model, x, args.where));
        return r ? project(model, r, args.select, args.include) : null;
      },
      async count(args: Q = {}) {
        return rows().filter((r) => matches(model, r, args.where)).length;
      },
      async create(args: Q) {
        for (const v of Object.values(args.data)) {
          if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) && ("create" in (v as Q) || "connect" in (v as Q))) {
            throw new Error("fake-prisma: nested writes are not supported (Neon HTTP can't run them)");
          }
        }
        // Like Prisma, an undefined field is ignored, not stored.
        const data = Object.fromEntries(Object.entries(args.data).filter(([, v]) => v !== undefined));
        const row: Row = { id: data.id ?? `${model}_${++seq}`, createdAt: new Date(), ...data };
        checkUnique(model, row);
        tables[model].push(row);
        return project(model, row, args.select, args.include);
      },
      async update(args: Q) {
        const r = rows().find((x) => matches(model, x, args.where));
        if (!r) throw new FakeP2025(`No ${model} found for update`);
        const next = { ...r };
        for (const [k, v] of Object.entries(args.data)) {
          if (v === undefined) continue; // Prisma ignores undefined fields
          if (v && typeof v === "object" && !(v instanceof Date) && "increment" in (v as Q)) next[k] = (r[k] ?? 0) + (v as Q).increment;
          else next[k] = v;
        }
        checkUnique(model, next, r);
        Object.assign(r, next);
        return project(model, r, args.select, args.include);
      },
      async delete(args: Q) {
        const i = rows().findIndex((x) => matches(model, x, args.where));
        if (i < 0) throw new FakeP2025(`No ${model} found for delete`);
        const [r] = tables[model].splice(i, 1);
        return r;
      },
      async deleteMany(args: Q = {}) {
        const before = rows().length;
        tables[model] = rows().filter((x) => !matches(model, x, args.where));
        return { count: before - tables[model].length };
      },
      async updateMany() {
        throw new Error("fake-prisma: updateMany fails on Neon HTTP (docs/known-limitations.md); don't use it");
      },
      async createMany() {
        throw new Error("fake-prisma: createMany fails on Neon HTTP (docs/known-limitations.md); don't use it");
      },
    };
  }

  const client: Row = { _tables: tables };
  for (const model of Object.keys(schema)) client[model] = delegate(model);
  // Raw SQL: only the exact statements listed in RAW_STATEMENTS (whitespace-
  // normalised, $n per bound value) are understood; anything else throws, so
  // a changed statement fails its tests instead of passing silently.
  client.$queryRaw = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = normalizeSql(strings, values.length);
    const handler = RAW_STATEMENTS[sql];
    if (!handler) throw new Error(`fake-prisma: unexpected raw SQL: ${sql}`);
    return handler(tables, values);
  };
  client.$transaction = async () => {
    throw new Error("fake-prisma: $transaction is not available on Neon HTTP");
  };
  return client;
}

/** Relations of the Client Hub models (and the existing models they touch). */
export function normalizeSql(strings: TemplateStringsArray, valueCount: number): string {
  return strings.reduce((acc, part, i) => acc + part + (i < valueCount ? `$${i + 1}` : ""), "").replace(/\s+/g, " ").trim();
}

/** Raw statements the Client Hub sends, emulated over the in-memory tables. */
export const RAW_STATEMENTS: Record<string, (tables: Record<string, Row[]>, values: unknown[]) => Row[]> = {
  // lib/portal/data.ts bookCall: claim a free future slot
  [`UPDATE "AvailableSlot" SET "isBooked" = true, "updatedAt" = $1 WHERE "id" = $2 AND "isBooked" = false AND "startsAt" > $3 RETURNING "id", "startsAt", "duration"`]: (tables, [at, id, now]) => {
    const slot = tables.availableSlot.find((x) => x.id === id && x.isBooked === false && x.startsAt > (now as Date));
    if (!slot) return [];
    Object.assign(slot, { isBooked: true, updatedAt: at });
    return [{ id: slot.id, startsAt: slot.startsAt, duration: slot.duration }];
  },
  // lib/portal/data.ts respondToApproval
  [`UPDATE "ApprovalRequest" SET "status" = CAST($1 AS "ApprovalRequestStatus"), "response" = $2, "respondedById" = $3, "respondedAt" = $4 WHERE "id" = $5 AND "status" = 'PENDING' RETURNING "id"`]: (tables, [status, response, by, at, id]) => {
    const a = tables.approvalRequest.find((x) => x.id === id && x.status === "PENDING");
    if (!a) return [];
    Object.assign(a, { status, response, respondedById: by, respondedAt: at });
    return [{ id: a.id }];
  },
};

export const CLIENT_HUB_SCHEMA: Schema = {
  user: {},
  client: {
    accountManager: { model: "user", kind: "one", from: "accountManagerId", to: "id" },
    users: { model: "clientUser", kind: "many", from: "id", to: "clientId" },
    projects: { model: "project", kind: "many", from: "id", to: "clientId" },
    reports: { model: "report", kind: "many", from: "id", to: "clientId" },
    invoices: { model: "invoice", kind: "many", from: "id", to: "clientId" },
    requests: { model: "clientRequest", kind: "many", from: "id", to: "clientId" },
  },
  clientUser: {
    client: { model: "client", kind: "one", from: "clientId", to: "id" },
    sessions: { model: "clientSession", kind: "many", from: "id", to: "clientUserId" },
    bookings: { model: "booking", kind: "many", from: "id", to: "clientUserId" },
    pushDevices: { model: "pushDevice", kind: "many", from: "id", to: "clientUserId" },
  },
  clientSession: {
    clientUser: { model: "clientUser", kind: "one", from: "clientUserId", to: "id" },
  },
  project: {
    client: { model: "client", kind: "one", from: "clientId", to: "id" },
    milestones: { model: "projectMilestone", kind: "many", from: "id", to: "projectId" },
    updates: { model: "projectUpdate", kind: "many", from: "id", to: "projectId" },
    approvals: { model: "approvalRequest", kind: "many", from: "id", to: "projectId" },
    reports: { model: "report", kind: "many", from: "id", to: "projectId" },
  },
  projectMilestone: {
    project: { model: "project", kind: "one", from: "projectId", to: "id" },
  },
  projectUpdate: {
    project: { model: "project", kind: "one", from: "projectId", to: "id" },
    author: { model: "user", kind: "one", from: "authorId", to: "id" },
    attachments: { model: "projectAttachment", kind: "many", from: "id", to: "updateId" },
  },
  projectAttachment: {
    update: { model: "projectUpdate", kind: "one", from: "updateId", to: "id" },
  },
  approvalRequest: {
    project: { model: "project", kind: "one", from: "projectId", to: "id" },
    respondedBy: { model: "clientUser", kind: "one", from: "respondedById", to: "id" },
  },
  report: {
    client: { model: "client", kind: "one", from: "clientId", to: "id" },
    project: { model: "project", kind: "one", from: "projectId", to: "id" },
  },
  invoice: {
    client: { model: "client", kind: "one", from: "clientId", to: "id" },
  },
  clientRequest: {
    client: { model: "client", kind: "one", from: "clientId", to: "id" },
    clientUser: { model: "clientUser", kind: "one", from: "clientUserId", to: "id" },
  },
  availableSlot: {
    booking: { model: "booking", kind: "one", from: "id", to: "slotId" },
  },
  booking: {
    slot: { model: "availableSlot", kind: "one", from: "slotId", to: "id" },
    clientUser: { model: "clientUser", kind: "one", from: "clientUserId", to: "id" },
  },
  pushDevice: {
    clientUser: { model: "clientUser", kind: "one", from: "clientUserId", to: "id" },
  },
  clientPushPreference: {},
  clientHubSetting: {},
  clientLoginCode: {},
  auditLog: {},
  siteSetting: {},
};
