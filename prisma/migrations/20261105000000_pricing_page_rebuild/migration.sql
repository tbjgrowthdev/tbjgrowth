-- Pricing page rebuild: schema only, no data. The old GBP-only PricingPlan
-- table is replaced (its two rows were confirmed disposable by the owner).
DROP TABLE IF EXISTS "PricingPlan";

CREATE TABLE "PricingCurrency" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PricingCurrency_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "PricingPackage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "number" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "isMostPopular" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "stageBuild" BOOLEAN NOT NULL DEFAULT false,
    "stageAttract" BOOLEAN NOT NULL DEFAULT false,
    "stageConvert" BOOLEAN NOT NULL DEFAULT false,
    "stageAutomate" BOOLEAN NOT NULL DEFAULT false,
    "stageScale" BOOLEAN NOT NULL DEFAULT false,
    "notIncluded" TEXT NOT NULL DEFAULT '',
    "moveUpTitle" TEXT NOT NULL DEFAULT '',
    "moveUpText" TEXT NOT NULL DEFAULT '',
    "ctaLabel" TEXT NOT NULL DEFAULT '',
    "ctaLink" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PricingPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingPrice" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "monthly" DECIMAL(14,2) NOT NULL,
    "setupFee" DECIMAL(14,2),
    "adSpendCap" DECIMAL(14,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PricingPrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingFeature" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PricingFeature_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingComparisonRow" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PricingComparisonRow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingComparisonCell" (
    "id" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "PricingComparisonCell_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingPolicy" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "PricingPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingPolicyText" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    CONSTRAINT "PricingPolicyText_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT '',
    "value" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "PricingSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PricingPackage_slug_key" ON "PricingPackage"("slug");
CREATE INDEX "PricingPackage_sortOrder_idx" ON "PricingPackage"("sortOrder");
CREATE UNIQUE INDEX "PricingPrice_packageId_currency_key" ON "PricingPrice"("packageId", "currency");
CREATE INDEX "PricingPrice_currency_idx" ON "PricingPrice"("currency");
CREATE UNIQUE INDEX "PricingFeature_packageId_label_key" ON "PricingFeature"("packageId", "label");
CREATE INDEX "PricingFeature_packageId_sortOrder_idx" ON "PricingFeature"("packageId", "sortOrder");
CREATE UNIQUE INDEX "PricingComparisonRow_label_key" ON "PricingComparisonRow"("label");
CREATE UNIQUE INDEX "PricingComparisonCell_rowId_packageId_key" ON "PricingComparisonCell"("rowId", "packageId");
CREATE UNIQUE INDEX "PricingPolicy_key_key" ON "PricingPolicy"("key");
CREATE UNIQUE INDEX "PricingPolicyText_policyId_currency_key" ON "PricingPolicyText"("policyId", "currency");
CREATE UNIQUE INDEX "PricingSetting_key_currency_key" ON "PricingSetting"("key", "currency");

ALTER TABLE "PricingPrice" ADD CONSTRAINT "PricingPrice_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "PricingPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PricingFeature" ADD CONSTRAINT "PricingFeature_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "PricingPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PricingComparisonCell" ADD CONSTRAINT "PricingComparisonCell_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "PricingComparisonRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PricingComparisonCell" ADD CONSTRAINT "PricingComparisonCell_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "PricingPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PricingPolicyText" ADD CONSTRAINT "PricingPolicyText_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "PricingPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
