-- Client Hub: meeting reminders about 24 h and 1 h ahead are sent once each
-- (lib/clients/reminders.ts). Additive and nullable: safe to apply before
-- the code that uses it is deployed.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "reminder1hSentAt" TIMESTAMP(3),
ADD COLUMN "reminder24hSentAt" TIMESTAMP(3);
