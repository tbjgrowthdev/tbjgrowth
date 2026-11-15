-- Additive: a table for replies emailed to contact-form leads from /admin/leads.
--
-- Deploy order: run this BEFORE deploying the code that reads it.

-- CreateTable
CREATE TABLE "LeadReply" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentById" TEXT,
    "sentByName" TEXT,
    "sentByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadReply_leadId_createdAt_idx" ON "LeadReply"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "LeadReply" ADD CONSTRAINT "LeadReply_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "FormSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

