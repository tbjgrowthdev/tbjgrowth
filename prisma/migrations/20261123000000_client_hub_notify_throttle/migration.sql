-- Client Hub: collapse bursts of system updates (milestones) into one client
-- push per project per hour. Additive and nullable: safe to apply before the
-- code that uses it is deployed.

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "lastClientNotifyAt" TIMESTAMP(3);
