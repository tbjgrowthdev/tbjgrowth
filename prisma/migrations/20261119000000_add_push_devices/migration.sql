-- Additive: push notification devices and per-user preferences for the
-- TBJ Admin Android app (lib/push/*).
--
-- Deploy order: run this BEFORE deploying the code that reads it.

-- CreateEnum
CREATE TYPE "PushEvent" AS ENUM ('NEW_LEAD', 'NEW_BOOKING', 'CONTENT_AWAITING_APPROVAL');

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminSessionId" TEXT,
    "platform" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushPreference" (
    "userId" TEXT NOT NULL,
    "event" "PushEvent" NOT NULL,
    "enabled" BOOLEAN NOT NULL,

    CONSTRAINT "PushPreference_pkey" PRIMARY KEY ("userId","event")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_token_key" ON "PushDevice"("token");

-- CreateIndex
CREATE INDEX "PushDevice_userId_idx" ON "PushDevice"("userId");

-- CreateIndex
CREATE INDEX "PushDevice_adminSessionId_idx" ON "PushDevice"("adminSessionId");

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_adminSessionId_fkey" FOREIGN KEY ("adminSessionId") REFERENCES "AdminSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushPreference" ADD CONSTRAINT "PushPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
