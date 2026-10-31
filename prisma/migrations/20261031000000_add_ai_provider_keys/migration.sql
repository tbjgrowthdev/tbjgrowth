-- Phase 68: AI provider API keys in the Integration Hub's encrypted store.
--
-- Additive only: new IntegrationProvider enum values, no table or column
-- changes. Each stored AI key is an Integration row whose
-- encryptedCredentials is AES-256-GCM ciphertext of { "apiKey": "..." }
-- (lib/integrations/crypto.ts); metadata holds only { "last4": "..." }.
--
-- Idempotent (ADD VALUE IF NOT EXISTS), and nothing in this migration uses
-- the new values, so Postgres's "unsafe use of new value" rule doesn't apply.
-- Apply with `npx prisma migrate deploy` BEFORE deploying the code that
-- reads them (the code falls back to env vars if this hasn't run yet).

ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'ANTHROPIC';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'OPENAI';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'GEMINI';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'XAI';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'OPENROUTER';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'CEREBRAS';
