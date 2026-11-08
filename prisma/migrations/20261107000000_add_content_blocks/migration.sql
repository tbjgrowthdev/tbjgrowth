-- Additive only: two nullable columns and one new table. Nothing is dropped,
-- rewritten or backfilled, and existing rows keep working untouched (a NULL
-- `blocks` means "classic rich-text page" / "no extra pSEO blocks"). Adding a
-- nullable column with no default is a metadata-only change in Postgres, so
-- it does not rewrite or lock the Page/PSeoTemplate tables for long.

-- AlterTable
ALTER TABLE "Page" ADD COLUMN "blocks" TEXT;

-- AlterTable
ALTER TABLE "PSeoTemplate" ADD COLUMN "blocks" TEXT;

-- CreateTable
CREATE TABLE "ContentBlock" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentBlock_name_key" ON "ContentBlock"("name");

-- CreateIndex
CREATE INDEX "ContentBlock_type_idx" ON "ContentBlock"("type");
