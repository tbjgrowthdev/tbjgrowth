-- CreateEnum
CREATE TYPE "PSeoPageStatus" AS ENUM ('PUBLISHED', 'NEEDS_REVIEW', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "SeoExperimentVariable" AS ENUM ('TITLE', 'META_DESCRIPTION', 'CTA', 'INTERNAL_LINKS', 'CONTENT_SECTION');

-- CreateEnum
CREATE TYPE "SeoExperimentStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'REVERTED');

-- CreateEnum
CREATE TYPE "PerformanceFeedbackSeverity" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "PerformanceFeedbackStatus" AS ENUM ('OPEN', 'DISMISSED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('GOOGLE_BUSINESS_PROFILE', 'META', 'CRM', 'SLACK', 'WORDPRESS', 'WEBHOOKS');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "AutomationEvent" AS ENUM ('CONTENT_PUBLISHED', 'RANKING_DECLINE', 'CTR_DECLINE', 'TRAFFIC_DECLINE', 'CONVERSION_DECLINE', 'CONTENT_DECAY', 'CANNIBALIZATION');

-- CreateEnum
CREATE TYPE "AutomationActionType" AS ENUM ('GENERATE_SCHEMA', 'UPDATE_SITEMAP', 'RUN_SEO_AUDIT', 'GENERATE_SOCIAL_DRAFT', 'NOTIFY_TEAM', 'CREATE_PERFORMANCE_ANALYSIS', 'CREATE_REFRESH_DRAFT', 'ASSIGN_REVIEWER');

-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'AWAITING_APPROVAL', 'REJECTED');

-- CreateEnum
CREATE TYPE "AutomationStepStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'AWAITING_APPROVAL', 'REJECTED');

-- CreateEnum
CREATE TYPE "SocialDraftStatus" AS ENUM ('DRAFT', 'DISMISSED');

-- AlterEnum
ALTER TYPE "PipelineStage" ADD VALUE 'PERFORMANCE_FEEDBACK';

-- AlterTable
ALTER TABLE "AiJob" ADD COLUMN     "performanceFeedbackId" TEXT;

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "intro" TEXT,
    "streetAddress" TEXT NOT NULL,
    "addressLocality" TEXT NOT NULL,
    "addressRegion" TEXT,
    "postalCode" TEXT,
    "addressCountry" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "serviceAreas" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isIndexable" BOOLEAN NOT NULL DEFAULT true,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "focusKeyword" TEXT,
    "secondaryKeywords" TEXT,
    "canonicalUrl" TEXT,
    "schemaJson" TEXT,
    "ogImage" TEXT,
    "twitterCard" TEXT,
    "allowFollow" BOOLEAN NOT NULL DEFAULT true,
    "maxSnippet" INTEGER NOT NULL DEFAULT -1,
    "maxImagePreview" TEXT NOT NULL DEFAULT 'large',
    "maxVideoPreview" INTEGER NOT NULL DEFAULT -1,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "twitterTitle" TEXT,
    "twitterDescription" TEXT,
    "twitterImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationFaq" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PSeoTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slugTemplate" TEXT NOT NULL,
    "titleTemplate" TEXT NOT NULL,
    "metaDescriptionTemplate" TEXT,
    "h1Template" TEXT,
    "bodyTemplate" TEXT NOT NULL,
    "requiredColumns" TEXT NOT NULL,
    "minWordCount" INTEGER NOT NULL DEFAULT 300,
    "duplicateSimilarityThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "isIndexable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PSeoTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PSeoDataset" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "columns" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PSeoDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PSeoDatasetRow" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PSeoDatasetRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PSeoPage" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metaDescription" TEXT,
    "h1" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "status" "PSeoPageStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "guardrailFindings" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PSeoPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoExperiment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "variable" "SeoExperimentVariable" NOT NULL,
    "beforeValue" TEXT NOT NULL,
    "afterValue" TEXT NOT NULL,
    "baselineWindowDays" INTEGER NOT NULL DEFAULT 28,
    "evaluationWindowDays" INTEGER NOT NULL DEFAULT 28,
    "status" "SeoExperimentStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "revertedAt" TIMESTAMP(3),
    "results" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceFeedback" (
    "id" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "signals" TEXT NOT NULL,
    "severity" "PerformanceFeedbackSeverity" NOT NULL,
    "aiSummary" TEXT NOT NULL,
    "aiRecommendations" TEXT NOT NULL,
    "status" "PerformanceFeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "encryptedCredentials" TEXT,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "lastError" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "metadata" TEXT,
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "event" "AutomationEvent" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "conditions" TEXT,
    "actions" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "event" "AutomationEvent" NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationStepRun" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "actionType" "AutomationActionType" NOT NULL,
    "config" TEXT NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "status" "AutomationStepStatus" NOT NULL DEFAULT 'PENDING',
    "output" TEXT,
    "error" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationStepRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialDraft" (
    "id" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "linkedinText" TEXT NOT NULL,
    "twitterText" TEXT NOT NULL,
    "status" "SocialDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlowQueryLog" (
    "id" TEXT NOT NULL,
    "model" TEXT,
    "action" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlowQueryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_slug_key" ON "Location"("slug");

-- CreateIndex
CREATE INDEX "Location_market_idx" ON "Location"("market");

-- CreateIndex
CREATE INDEX "LocationFaq_locationId_idx" ON "LocationFaq"("locationId");

-- CreateIndex
CREATE INDEX "PSeoDataset_templateId_idx" ON "PSeoDataset"("templateId");

-- CreateIndex
CREATE INDEX "PSeoDatasetRow_datasetId_idx" ON "PSeoDatasetRow"("datasetId");

-- CreateIndex
CREATE UNIQUE INDEX "PSeoPage_rowId_key" ON "PSeoPage"("rowId");

-- CreateIndex
CREATE UNIQUE INDEX "PSeoPage_slug_key" ON "PSeoPage"("slug");

-- CreateIndex
CREATE INDEX "PSeoPage_templateId_idx" ON "PSeoPage"("templateId");

-- CreateIndex
CREATE INDEX "PSeoPage_datasetId_idx" ON "PSeoPage"("datasetId");

-- CreateIndex
CREATE INDEX "PSeoPage_status_idx" ON "PSeoPage"("status");

-- CreateIndex
CREATE INDEX "SeoExperiment_contentType_contentId_idx" ON "SeoExperiment"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "SeoExperiment_status_idx" ON "SeoExperiment"("status");

-- CreateIndex
CREATE INDEX "PerformanceFeedback_status_idx" ON "PerformanceFeedback"("status");

-- CreateIndex
CREATE INDEX "PerformanceFeedback_severity_idx" ON "PerformanceFeedback"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceFeedback_contentType_contentId_key" ON "PerformanceFeedback"("contentType", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_provider_key" ON "Integration"("provider");

-- CreateIndex
CREATE INDEX "Integration_status_idx" ON "Integration"("status");

-- CreateIndex
CREATE INDEX "AutomationRule_event_enabled_idx" ON "AutomationRule"("event", "enabled");

-- CreateIndex
CREATE INDEX "AutomationRun_status_idx" ON "AutomationRun"("status");

-- CreateIndex
CREATE INDEX "AutomationRun_ruleId_idx" ON "AutomationRun"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationStepRun_runId_stepIndex_key" ON "AutomationStepRun"("runId", "stepIndex");

-- CreateIndex
CREATE INDEX "SocialDraft_status_idx" ON "SocialDraft"("status");

-- CreateIndex
CREATE INDEX "SocialDraft_contentType_contentId_idx" ON "SocialDraft"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "SlowQueryLog_createdAt_idx" ON "SlowQueryLog"("createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_success_createdAt_idx" ON "EmailLog"("success", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE INDEX "AiJob_performanceFeedbackId_idx" ON "AiJob"("performanceFeedbackId");

-- AddForeignKey
ALTER TABLE "AiJob" ADD CONSTRAINT "AiJob_performanceFeedbackId_fkey" FOREIGN KEY ("performanceFeedbackId") REFERENCES "PerformanceFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationFaq" ADD CONSTRAINT "LocationFaq_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PSeoDataset" ADD CONSTRAINT "PSeoDataset_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PSeoTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PSeoDatasetRow" ADD CONSTRAINT "PSeoDatasetRow_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "PSeoDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PSeoPage" ADD CONSTRAINT "PSeoPage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PSeoTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PSeoPage" ADD CONSTRAINT "PSeoPage_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "PSeoDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PSeoPage" ADD CONSTRAINT "PSeoPage_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "PSeoDatasetRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationStepRun" ADD CONSTRAINT "AutomationStepRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

