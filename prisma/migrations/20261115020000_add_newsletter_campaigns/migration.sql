-- Additive: the newsletter auto-send switch (off by default) and one row per
-- blog post emailed to subscribers.
--
-- Deploy order: run this BEFORE deploying the code that reads it.

-- CreateEnum
CREATE TYPE "NewsletterCampaignStatus" AS ENUM ('SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "SiteSetting" ADD COLUMN     "newsletterAutoSend" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "NewsletterCampaign" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "postTitle" TEXT NOT NULL,
    "postSlug" TEXT NOT NULL,
    "status" "NewsletterCampaignStatus" NOT NULL DEFAULT 'SENDING',
    "cursor" TEXT,
    "cutoff" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "NewsletterCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterCampaign_postId_key" ON "NewsletterCampaign"("postId");

-- CreateIndex
CREATE INDEX "NewsletterCampaign_status_createdAt_idx" ON "NewsletterCampaign"("status", "createdAt");

