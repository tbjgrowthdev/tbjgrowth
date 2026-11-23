-- A cancelled booking whose slot is booked again from the portal is kept,
-- detached from the slot, with the time it was for copied onto it.
-- The unique index on "slotId" stays: Postgres allows any number of NULLs.
ALTER TABLE "Booking" ALTER COLUMN "slotId" DROP NOT NULL;
ALTER TABLE "Booking" ADD COLUMN "slotStartsAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "slotDuration" INTEGER;
