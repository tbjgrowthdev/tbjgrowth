-- Additive only: one nullable column. Nothing is dropped, rewritten or backfilled,
-- and existing case studies keep working untouched (a NULL `blocks` means
-- "classic rich-text case study"). Adding a nullable column with no default is a
-- metadata-only change in Postgres, so it does not rewrite the CaseStudy table
-- and only holds its lock for an instant.
--
-- Deploy order: run this migration BEFORE deploying the code that reads the
-- column (Prisma selects every column, so new code against an unmigrated
-- database fails every CaseStudy query).

-- AlterTable
ALTER TABLE "CaseStudy" ADD COLUMN "blocks" TEXT;
