-- Part 1 of 2 of the migration-history baseline (see
-- 20261021000001_sync_missing_models for the full explanation).
--
-- Only the new values for enums that `second` created. Split into its own
-- migration because Postgres refuses to use an enum value in the same
-- transaction that added it ("unsafe use of new value"), and part 2 sets
-- User.role's default to 'CONTRIBUTOR'. Prisma commits each migration
-- separately, so these are committed before part 2 runs.
--
-- Idempotent (ADD VALUE IF NOT EXISTS). See docs/deployment.md — test on
-- staging before applying to production.

ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'REVIEW';
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SEO_MANAGER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CONTRIBUTOR';
