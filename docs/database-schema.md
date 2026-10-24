# Database Schema

Source of truth: `prisma/schema.prisma` (2066 lines, ~75 models/enums as of this writing) — this doc is a navigable summary, grouped by feature area, not a replacement for reading the schema file itself, which is heavily commented with the *why* behind each non-obvious field.

## Two connection strings

`prisma.config.ts` reads `DIRECT_URL` — Neon's **unpooled** connection string — for every Prisma CLI command (`migrate diff`, `migrate deploy`, `db execute`). The running app, via `lib/prisma.ts`, instead uses `DATABASE_URL` — the **pooled** (`pgbouncer=true`) connection string — through the `PrismaNeonHttp` adapter. Both point at the same database. This split exists because migrations need a direct connection, but the app itself (especially on Cloudflare Workers) benefits from pooling. Mixing them up (e.g. running `migrate deploy` against `DATABASE_URL`) is a common source of confusion — always check which env var a given tool actually reads. See `docs/environment-variables.md` and `docs/known-limitations.md`.

## Auth (NextAuth)

| Model | Purpose |
|---|---|
| `User` | The admin account. `role` (enum `Role`: `SUPER_ADMIN`/`ADMIN`/`EDITOR`/`SEO_MANAGER`/`CONTRIBUTOR`) drives all permission checks (`lib/permissions.ts`). `password` is nullable — reserved for a future SSO-only account. TOTP fields (`twoFactorSecret`/`twoFactorEnabled`/`twoFactorBackupCodes`) live here too. |
| `Account`, `Session`, `VerificationToken` | NextAuth's standard adapter shape. **Currently unused** — this app is Credentials+JWT only — reserved for adding an OIDC/SSO provider later without a schema migration. |
| `AdminSession` | The *actual* session-list/device-revocation table this app uses instead of `Session` above. One row per sign-in (ip, user-agent, `revokedAt`). The JWT carries this row's id; see `docs/architecture.md`'s Auth section. |
| `LoginAttempt` | Every login attempt (email, success, ip) — backs both the brute-force lockout and the Monitoring → Logins admin view. |

## Content (Posts, Pages, Case Studies, taxonomy, workflow)

| Model | Purpose |
|---|---|
| `Post`, `Page`, `CaseStudy` | The three content types with the approval workflow. Each carries its own full SEO field set (meta title/description, focus/secondary keywords, canonical URL, schema JSON, robots directives, OG/Twitter overrides) duplicated across all three rather than shared via a join table — a deliberate "three similar blocks beat a premature abstraction" choice per this codebase's convention. `status` is `PostStatus` (shared enum, also used by `CaseStudy`): `DRAFT → REVIEW → (CHANGES_REQUESTED → REVIEW)* → APPROVED → SCHEDULED\|PUBLISHED → ARCHIVED`. `reviewerId`/`seoReviewerId`/`approverId` are **plain id pointers, not Prisma relations** (resolved via manual lookup where displayed) — same lightweight pattern used throughout this schema to avoid growing `User` with more back-relation arrays every time a new role-assignment field is added. |
| `Category`, `Tag` | Shared taxonomy across `Post` and `CaseStudy`. |
| `ApprovalHistory` | Append-only audit trail of every workflow transition (`fromStatus`→`toStatus`, `action`, `actorId`, `comment`). Written by `lib/workflow.ts`. See `docs/cms-workflow.md`. |
| `ContentVersion` | Full-content snapshots (append-only) for history/compare/restore — distinct from `ApprovalHistory` (status transitions only) and `AuditLog` (lean, system-wide). Restoring an old version writes a **new** version on top rather than deleting anything. |
| `ContentLock` | Advisory "so-and-so has this open" claim, not an authoritative lock — the real conflict guard is an `updatedAt` check at save time. Covers `POST`/`PAGE`/`CASE_STUDY`/`SERVICE` via a plain string, not the `ContentType` enum (Services never had the approval workflow). |
| `ContentTranslation` | One row per (content item, locale) — an **overlay**, not a duplicate: every field is nullable and only overrides the base record when present. See `lib/i18n.ts`/`lib/translation.ts`. |
| `AuditLog` | System-wide, append-only, immutable mutation log (content, SEO, settings, users, roles, publishing, approval, media, redirects, integrations) — denormalized actor snapshot (name/email/role *at the time*) so an entry survives the user being deleted or changing role later. Deletion restricted to `SUPER_ADMIN`. |
| `MediaAsset` | Central media library (Cloudinary-backed) — parallel to, not a foreign key from, the scattered image-URL string fields elsewhere; picking/uploading here just hands back a URL to paste. `altText` required at upload time. |
| `Redirect`, `NotFoundLog` | Redirect map (301/302/307/410) and 404 tracking. |
| `ScheduledJob` | Future publish/unpublish/update actions. Retry-safe by construction: the cron processor atomically claims a `PENDING` row before acting (`PENDING→PROCESSING`), reverts to `PENDING` on failure until `attempts` caps out, then `FAILED` — never silently dropped. |

## Booking

| Model | Purpose |
|---|---|
| `AvailableSlot` | A bookable time slot. No unique constraint on `startsAt` — multiple slots can share a start time if needed. |
| `Booking` | **`slotId` is `@unique`.** This is the real concurrency guard for double-booking — see `docs/known-limitations.md` for why (the Neon HTTP adapter can't do an atomic conditional `updateMany`, so `app/(admin)/actions/booking.ts`'s `createBooking` relies on this DB constraint plus a `P2002` catch instead). |

## Leads

| Model | Purpose |
|---|---|
| `FormSubmission` | Contact-form leads. |
| `PricingPlan`, `Testimonial`, `Faq`, `TrustedPartner`, `TBJSystem`, `AgencyService` (+ `ServiceFaq`), `SiteSetting` | Public-site content/config models, outside the approval-workflow content types. |

## AI Content Pipeline

| Model | Purpose |
|---|---|
| `ContentPipelineRun` | One run of Brief→...→Publish. `stage` (enum `PipelineStage`) is the last completed stage. Brief/searchIntent/research/outline are stored as JSON strings on this row *until* the Draft stage, after which the real `Post`/`CaseStudy` row (via `contentId`) becomes the single source of truth — this row stops duplicating fields that now live there. |
| `AiJob` | One tracked AI-provider call per (run, stage). `idempotencyKey` (`"<runId>:<stage>"`, unique) is the actual idempotency mechanism — a stage that's already `COMPLETED` is never re-run. Exactly one of `pipelineRunId`/`contentRefreshId`/`performanceFeedbackId` is set (not a discriminated union — Prisma has no clean way to express that). Tracks `inputTokens`/`outputTokens`/`costUsd` (null, never a wrong guess, when the model isn't in the pricing table). |
| `PromptTemplate` / `PromptTemplateVersion` | Versioned, admin-editable prompt text per `PromptCategory`. Every edit creates a new immutable version; "rollback" just repoints `activeVersionId`. |
| `BrandKnowledgeSection` / `BrandKnowledgeVersion` | Same versioned shape as prompts, for brand-voice/audience/forbidden-terms content injected into every pipeline stage. |
| `ContentRefresh` | One cycle of detecting a stale published page and staging an AI-drafted revision — the live content row is untouched until a human approves *and* applies it. |
| `ContentRecommendation` | Deterministic keyword-gap suggestions (no AI, no `AiJob`). `keyword` is `@unique` — a rescan upserts by keyword. |
| `ContentCannibalization` | A pair of pages competing for intent. `contentIdA`/`contentIdB` stored in canonical sort order (enforced in code) so a rescan can't create the pair's mirror image. Purely advisory — never merges/redirects/edits anything itself. |
| `PerformanceFeedback` | One AI-written diagnosis per page, synthesizing `ContentRefresh`/`ContentCannibalization` signals. `@@unique([contentType, contentId])`. |
| `ContentHealthScore` | A recomputed **snapshot** (not a lifecycle) — always overwritten on rescan. |
| `OrphanPage` | Published Post/CaseStudy with 0–1 inbound internal links. `contentId` is `@unique`. |

See `docs/ai-workflow.md` and `docs/runbooks/ai-content-pipeline.md` for the full stage-by-stage behavior.

## SEO suite

| Model | Purpose |
|---|---|
| `PSeoTemplate` / `PSeoDataset` / `PSeoDatasetRow` / `PSeoPage` | Programmatic SEO: a template with `{{column}}` placeholders, a CSV dataset of rows, and the materialized, guardrail-checked page per row. `PSeoPage.status` (`PUBLISHED`/`NEEDS_REVIEW`/`OVERRIDDEN`) — a page that fails a guardrail (thin content, near-duplicate) is still created but forced `noindex` until a human overrides it, never silently dropped. |
| `SeoExperiment` | Sequential before/after test on a **real** content field (title/meta description/CTA/internal links/content section) — not live traffic-splitting (no infra for that here, and it risks a cloaking penalty). Snapshots `beforeValue`, writes `afterValue` to the live record, compares `SearchConsoleMetric`/`AnalyticsLandingPageMetric` across baseline vs. evaluation windows. `contentType` is a plain string (not the `ContentType` enum) because it must also cover `"SERVICE"`. |
| `SearchConsoleMetric` | One row per (date, query, page, country, device) from GSC's `searchAnalytics.query`, persisted via `lib/gsc-import.ts` so history survives without re-hitting the API. `@@unique([date, query, page, country, device])`. |
| `AnalyticsLandingPageMetric` | One row per (date, landing page) from the GA4 Data API, Organic Search channel only, via `lib/ga4-import.ts`. `engagementRate`/`conversionRate` are deliberately **not** stored — always derived at query time from summed counts, since averaging per-row rates would be wrong. `@@unique([date, landingPage])`. |
| `TrackedKeyword` / `RankCheck` / `CompetitorDomain` | Rank tracking. `@@unique([term, targetUrl])` on `TrackedKeyword`. |
| `GoogleIntegration` | Singleton row holding the GSC/GA4 OAuth tokens (separate from the generic `Integration` table below — Google Search Console/Analytics already had a dedicated OAuth flow before the Integration Hub existed). |
| `LinkCheckRun` | One row per broken-link crawl (internal + external), scheduled or manual. |
| `SeoAuditRun` | One row per run of the 14-category Automated SEO Audit. Two of those categories reuse the latest `LinkCheckRun`/redirect-analysis output rather than re-crawling. |

No `InternalLink` or `TopicCluster` table exists — both the internal-link graph (`lib/link-graph/`) and topic clustering (`lib/topic-clusters/`) are **computed on read** from existing Post/Page/CaseStudy/Service content, not persisted.

## Integration Hub & Automation Engine

| Model | Purpose |
|---|---|
| `Integration` | One singleton row per `IntegrationProvider` (`GOOGLE_BUSINESS_PROFILE`/`META`/`CRM`/`SLACK`/`WORDPRESS`/`WEBHOOKS`) — **only** the providers with no other home. `encryptedCredentials` is AES-256-GCM ciphertext (`lib/integrations/crypto.ts`), decrypted only in memory when a call actually needs it. GSC/GA4 (`GoogleIntegration`), AI providers, and Resend are configured via env vars instead and are not duplicated here — the admin UI mirrors their status from those sources (`lib/integrations/mirror.ts`). |
| `AutomationRule` | Event → optional conditions → ordered action chain. `conditions`/`actions` are JSON, not normalized child tables (small, rule-owned, nothing else references "step 2 of rule X"). |
| `AutomationRun` / `AutomationStepRun` | One row per time a rule fired, and one row per action in its chain. A step with `requiresApproval` stops the run at `AWAITING_APPROVAL`, leaving later steps `PENDING` until a human with `APPROVE` decides. |
| `SocialDraft` | Output of the `GENERATE_SOCIAL_DRAFT` action — always human-reviewed copy-paste text, **never auto-posted** (no provider here is wired for publish access). |

## Observability / ops self-reporting

All of these follow the same pattern: work that can't run inside the Cloudflare Worker (shelling out to `pg_dump`, probing the site from *outside* Cloudflare) runs in GitHub Actions and reports its result back via a `CRON_SECRET`-protected endpoint.

| Model | Purpose |
|---|---|
| `BackupRun` | One row per nightly `pg_dump`+R2-upload+verify attempt (`.github/workflows/db-backup.yml`). See `docs/backup-process.md` / `docs/restore-process.md`. |
| `UptimeCheck` | One row per external uptime probe (`.github/workflows/uptime-check.yml`). `contentOk` is checked in addition to the HTTP status — a degraded DB can still serve a 200 with an empty page, which happened once in production. |
| `ErrorLog` | Server (`instrumentation.ts`'s `onRequestError`) and client (`app/global-error.tsx`) crash capture — this app's Sentry substitute. `fingerprint` only dedupes alerts, it's not a real grouping engine. |
| `SlowQueryLog` | Queries over the threshold in `lib/prisma.ts`'s timing wrapper (1000ms — intentionally higher than you'd set for a persistent connection, since the HTTP adapter's per-query fetch overhead already runs higher). Fire-and-forget; never throws back into the query it's timing. |
| `EmailLog` | Every outbound send attempt via `lib/email.ts`'s `deliverResendEmail`, success or failure. |
| `WebVitalSample` | Client-reported Core Web Vitals (LCP/CLS/INP/FCP/TTFB). |

See `docs/monitoring.md`.

## Notable constraints worth knowing about

- `Booking.slotId @unique` — the double-booking race guard (see above).
- `AiJob.idempotencyKey @unique` — the "never re-run a completed stage" guarantee.
- `ContentTranslation @@unique([contentType, contentId, locale])` and `@@unique([contentType, locale, slug])` — Postgres treats multiple `NULL`s as distinct, so untranslated rows never collide on the second constraint.
- `PerformanceFeedback @@unique([contentType, contentId])`, `OrphanPage.contentId @unique`, `ContentHealthScore @@unique([contentType, contentId])` — all "one live row per content item," always overwritten/upserted on rescan rather than accumulating history.
- `ContentCannibalization @@unique([contentIdA, contentIdB])` with canonical sort order enforced in application code, not the DB.
