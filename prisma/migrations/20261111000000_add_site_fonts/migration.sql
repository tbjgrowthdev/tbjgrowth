-- Additive only: two nullable columns (NULL = site default fonts). Metadata-only
-- change in Postgres; nothing is rewritten or backfilled.
--
-- Deploy order: run this migration BEFORE deploying the code that reads the
-- columns (Prisma selects every column, so new code against an unmigrated
-- database fails every SiteSetting query, which the public layout runs).
ALTER TABLE "SiteSetting" ADD COLUMN "headingFont" TEXT,
ADD COLUMN "bodyFont" TEXT;
