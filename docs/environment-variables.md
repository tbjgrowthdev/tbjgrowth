# Environment Variables

Source: `.env.example` (copy to `.env` for local `next dev`; `.env*` is gitignored).

**Never put a real value in `wrangler.jsonc`.** This repo already hit that exact mistake once — a commit put every production secret into `wrangler.jsonc`'s `vars` block in plaintext; GitHub's push protection caught it before it reached the remote and the commits were rewritten out of history. Treat that as a live reminder, not a closed incident (`docs/runbooks/security.md`). For the deployed Worker, every real value lives in **Cloudflare dashboard → Workers & Pages → the Worker → Settings → Variables and Secrets**, never in this repo and never in Cloudflare's "Build variables" (those are build-time-only and invisible at runtime).

## Database

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | `lib/prisma.ts` | **Pooled** Neon connection string (`pgbouncer=true`) — what the running app actually queries through, via the `PrismaNeonHttp` adapter. |
| `DIRECT_URL` | `prisma.config.ts` only | **Unpooled** Neon connection string. Used exclusively by the Prisma CLI (`migrate diff`/`migrate deploy`/`db execute`) and by CI's backup/restore scripts (as `DATABASE_URL_DIRECT` in GitHub Actions secrets — see `docs/backup-process.md`). Never read by the running app itself. |

## Auth

| Variable | Used by | Notes |
|---|---|---|
| `NEXTAUTH_SECRET` | NextAuth (JWT signing) | Must be set in the Worker's runtime **Secrets**, not Build variables — this exact distinction caused an incident previously. |
| `NEXTAUTH_URL` | NextAuth | `http://localhost:3000` locally; the live site's URL in production. |
| `NEXT_PUBLIC_BASE_URL` | ~20 files across `lib/` and public page routes (sitemap, canonical/hreflang, schema.org URLs, search-engine ping, `robots.txt`) | The canonical site origin used to build absolute URLs server-side. Public (`NEXT_PUBLIC_*`), so it's inlined at build time too. |
| `CRON_SECRET` | every `app/api/cron/*` route | Bearer-token auth for cron/report endpoints, checked independently of any user session. Must match the value GitHub Actions workflows send. See `docs/deployment.md`. |

## Google (OAuth — Search Console + GA4)

| Variable | Used by |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | `lib/google-oauth.ts`, `app/api/google/connect`, `app/api/google/callback` — the OAuth flow behind `GoogleIntegration` (GSC + GA4 property access). |

## Email

| Variable | Used by |
|---|---|
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | `lib/email.ts` — every outbound email (booking notifications, contact form, account-locked alerts, scheduled-job/automation failure notices). Every send, success or failure, is logged to `EmailLog`. |

## Media

| Variable | Used by |
|---|---|
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | `lib/cloudinary.ts` — upload/destroy for the Media Library and AI-generated images. |

## SEO data

| Variable | Used by |
|---|---|
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | `lib/seo-services.ts` — Rank Tracker search volume/difficulty, and (optionally) the AI pipeline's Search Intent/Research stages for live search-volume and SERP data. Missing credentials degrade gracefully — those two stages fall back to reasoning without live data rather than failing. |

## Integration Hub

| Variable | Used by |
|---|---|
| `INTEGRATION_ENCRYPTION_KEY` | `lib/integrations/crypto.ts` — AES-256-GCM key encrypting stored credentials for Google Business Profile, Meta, CRM, Slack, WordPress, and Webhooks (the providers with no other home — see `docs/database-schema.md`'s `Integration` model). Generate with `openssl rand -base64 32`. **Rotating this key without a migration plan orphans every already-stored credential** — they become undecryptable ciphertext. |

## AI Content Pipeline

| Variable | Used by | Notes |
|---|---|---|
| `AI_PROVIDER` | `lib/content-pipeline/providers/index.ts` | `anthropic` (default) \| `openai` \| `gemini`. Picks which provider every **text** stage calls. Switching is a config change only — see `docs/ai-workflow.md`. |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | `lib/content-pipeline/providers/anthropic.ts` | Only needed if `AI_PROVIDER=anthropic`. |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | `lib/content-pipeline/providers/openai.ts` | Only needed if `AI_PROVIDER=openai` (or for image generation, see below). |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | `lib/content-pipeline/providers/gemini.ts` | Only needed if `AI_PROVIDER=gemini` (or for image generation, see below). |
| `AI_IMAGE_PROVIDER` | `lib/content-pipeline/providers/index.ts` | `openai` (default) \| `gemini`. **Separate** selection from `AI_PROVIDER` — Anthropic has no image-generation API, so the Image stage always needs one of the other two providers' key configured regardless of which text provider is active. |
| `OPENAI_IMAGE_MODEL` | `lib/content-pipeline/providers/openai-image.ts` | |
| `GEMINI_IMAGE_MODEL` | `lib/content-pipeline/providers/gemini-image.ts` | |

Missing the key matching the active provider fails every AI-driven stage with `"<KEY> is not configured"` — the run just sits at its current stage, nothing is lost, and re-running the stage after setting the key picks up cleanly.

## Not in `.env.example` but required in CI (GitHub Actions secrets)

These never touch the running app — they're read only by `.github/workflows/*.yml` for backup/restore/uptime automation. See `docs/backup-process.md` / `docs/restore-process.md` for the full list and setup steps: `PRODUCTION_URL`, `DATABASE_URL_DIRECT`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `NEON_API_KEY`, `NEON_PROJECT_ID`, plus the same `CRON_SECRET` value as the Worker.
