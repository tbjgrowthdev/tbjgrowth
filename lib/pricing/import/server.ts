// Server-side half of the import: load the current snapshot, and apply a plan
// inside ONE transaction.
//
// The app's shared Prisma client uses PrismaNeonHttp, which cannot run
// transactions (see lib/prisma.ts). So applyPlan opens a short-lived
// WebSocket-based client just for the write and closes it afterwards - a
// fresh client per call is exactly what the Workers I/O rule requires.

import prisma from "@/lib/prisma";
import { PrismaClient, type Prisma } from "@/lib/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import type { Plan, Snapshot } from "./plan";

const n = (v: unknown) => Number(v);
const nn = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function loadSnapshot(): Promise<Snapshot> {
  const [settings, currencies, packages, prices, features, rows, cells, policies, policyTexts] = await Promise.all([
    prisma.pricingSetting.findMany(),
    prisma.pricingCurrency.findMany(),
    prisma.pricingPackage.findMany(),
    prisma.pricingPrice.findMany({ include: { package: { select: { slug: true } } } }),
    prisma.pricingFeature.findMany({ include: { package: { select: { slug: true } } } }),
    prisma.pricingComparisonRow.findMany(),
    prisma.pricingComparisonCell.findMany({ include: { row: { select: { label: true } }, package: { select: { slug: true } } } }),
    prisma.pricingPolicy.findMany(),
    prisma.pricingPolicyText.findMany({ include: { policy: { select: { key: true } } } }),
  ]);
  return {
    settings: settings.map((s) => ({ key: s.key, currency: s.currency, value: s.value })),
    currencies: currencies.map((c) => ({ code: c.code, label: c.label, isEnabled: c.isEnabled, sortOrder: c.sortOrder })),
    packages: packages.map((p) => ({
      slug: p.slug, name: p.name, number: p.number, tagline: p.tagline, description: p.description,
      isMostPopular: p.isMostPopular, isActive: p.isActive, sortOrder: p.sortOrder,
      stageBuild: p.stageBuild, stageAttract: p.stageAttract, stageConvert: p.stageConvert, stageAutomate: p.stageAutomate, stageScale: p.stageScale,
      notIncluded: p.notIncluded, moveUpTitle: p.moveUpTitle, moveUpText: p.moveUpText, ctaLabel: p.ctaLabel, ctaLink: p.ctaLink,
    })),
    prices: prices.map((p) => ({ slug: p.package.slug, currency: p.currency, monthly: n(p.monthly), setupFee: nn(p.setupFee), adSpendCap: nn(p.adSpendCap), isActive: p.isActive })),
    features: features.map((f) => ({ slug: f.package.slug, label: f.label, text: f.text, sortOrder: f.sortOrder })),
    rows: rows.map((r) => ({ label: r.label, sortOrder: r.sortOrder })),
    cells: cells.map((c) => ({ label: c.row.label, slug: c.package.slug, text: c.text })),
    policies: policies.map((p) => ({ key: p.key, title: p.title, sortOrder: p.sortOrder, text: p.text })),
    policyTexts: policyTexts.map((t) => ({ key: t.policy.key, currency: t.currency, text: t.text })),
  };
}

export async function applyPlan(plan: Plan): Promise<void> {
  const connectionString = process.env.DATABASE_URL as string;
  const client = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
  try {
    await client.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const u = plan.upserts;
        if (plan.mode === "replace") {
          await tx.pricingComparisonRow.deleteMany();
          await tx.pricingPolicy.deleteMany();
          await tx.pricingSetting.deleteMany();
          await tx.pricingCurrency.deleteMany();
          await tx.pricingPackage.deleteMany(); // cascades prices, features, cells
        }
        for (const s of u.settings) {
          await tx.pricingSetting.upsert({ where: { key_currency: { key: s.key, currency: s.currency } }, create: s, update: { value: s.value } });
        }
        for (const c of u.currencies) {
          await tx.pricingCurrency.upsert({ where: { code: c.code }, create: c, update: { label: c.label, isEnabled: c.isEnabled, sortOrder: c.sortOrder } });
        }
        for (const p of u.packages) {
          const { slug, ...fields } = p;
          await tx.pricingPackage.upsert({ where: { slug }, create: { slug, ...fields }, update: fields });
        }
        const pkgIds = new Map((await tx.pricingPackage.findMany({ select: { id: true, slug: true } })).map((p) => [p.slug, p.id]));
        const pid = (slug: string) => {
          const id = pkgIds.get(slug);
          if (!id) throw new Error(`Package "${slug}" not found`);
          return id;
        };
        for (const p of u.prices) {
          const data = { monthly: p.monthly, setupFee: p.setupFee, adSpendCap: p.adSpendCap, isActive: p.isActive };
          await tx.pricingPrice.upsert({ where: { packageId_currency: { packageId: pid(p.slug), currency: p.currency } }, create: { packageId: pid(p.slug), currency: p.currency, ...data }, update: data });
        }
        for (const f of u.features) {
          await tx.pricingFeature.upsert({ where: { packageId_label: { packageId: pid(f.slug), label: f.label } }, create: { packageId: pid(f.slug), label: f.label, text: f.text, sortOrder: f.sortOrder }, update: { text: f.text, sortOrder: f.sortOrder } });
        }
        for (const r of u.rows) {
          await tx.pricingComparisonRow.upsert({ where: { label: r.label }, create: r, update: { sortOrder: r.sortOrder } });
        }
        const rowIds = new Map((await tx.pricingComparisonRow.findMany({ select: { id: true, label: true } })).map((r) => [r.label, r.id]));
        for (const c of u.cells) {
          const rowId = rowIds.get(c.label);
          if (!rowId) throw new Error(`Comparison row "${c.label}" not found`);
          await tx.pricingComparisonCell.upsert({ where: { rowId_packageId: { rowId, packageId: pid(c.slug) } }, create: { rowId, packageId: pid(c.slug), text: c.text }, update: { text: c.text } });
        }
        for (const p of u.policies) {
          await tx.pricingPolicy.upsert({ where: { key: p.key }, create: p, update: { title: p.title, sortOrder: p.sortOrder, text: p.text } });
        }
        const polIds = new Map((await tx.pricingPolicy.findMany({ select: { id: true, key: true } })).map((p) => [p.key, p.id]));
        for (const t of u.policyTexts) {
          const policyId = polIds.get(t.key);
          if (!policyId) throw new Error(`Policy "${t.key}" not found`);
          await tx.pricingPolicyText.upsert({ where: { policyId_currency: { policyId, currency: t.currency } }, create: { policyId, currency: t.currency, text: t.text }, update: { text: t.text } });
        }
      },
      { timeout: 60_000, maxWait: 15_000 },
    );
  } finally {
    await client.$disconnect();
  }
}
