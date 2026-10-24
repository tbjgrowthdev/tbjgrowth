# API Documentation

This app has no general-purpose REST API. There are two separate surfaces, and
they exist for different reasons — don't reach for one where the other fits.

1. **Next.js Server Actions** (`app/(admin)/actions/*.ts`) — the real API.
   Every admin mutation and most admin reads go through a `"use server"`
   function called directly from a Client Component, not through `fetch()`.
   This is why `app/api/` has no `/posts`, `/pages`, `/bookings`, etc. — those
   operations are Server Actions, invoked by Next.js's own RPC mechanism
   (same-origin only, CSRF-protected by the framework — see
   `docs/runbooks/security.md`'s CSRF section).
2. **`app/api/**` route handlers** — a small, deliberately narrow set, for the
   three things Server Actions can't do: unauthenticated public endpoints
   (web vitals, client-error reporting), OAuth redirect targets, and
   cron-triggered background jobs that have no browser session to call a
   Server Action with.

## `app/api/**` routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth's own CSRF/session handling | NextAuth v4 catch-all — login, logout, session/JWT callbacks (`lib/auth.ts`). |
| `/api/google/connect` | GET | Session, `role === "ADMIN"` (see note below) | Starts the Google OAuth flow (GSC/GA4), sets a `google_oauth_state` cookie, redirects to Google. |
| `/api/google/callback` | GET | Session, `role === "ADMIN"` (see note below) | OAuth redirect target. Verifies `state`, exchanges the code for tokens, upserts the single `GoogleIntegration` row. |
| `/api/internal/redirects` | GET | None (intentionally public) | Returns the `source → destination` redirect map as JSON. Called by `middleware.ts`, which runs on the Edge runtime and has no direct Prisma driver access — this route is how it reaches the DB. Not sensitive: a visitor could discover the same mapping by following the redirects themselves. |
| `/api/internal/client-error` | POST | None (a crashed client can't carry a session) | Reports a client-side error into `lib/error-monitor.ts`'s `captureError`. Abuse-bounded by that module's own per-fingerprint alert dedup, not by auth. |
| `/api/web-vitals` | POST | None | Stores one Core Web Vitals sample (`WebVitalSample`) from real-user monitoring in the browser. Validates `metric` against a fixed set (`LCP`/`CLS`/`INP`/`FCP`/`TTFB`) and that `value` is a number before writing. |
| `/api/cron/scheduled-jobs` | GET | Bearer `CRON_SECRET` | Runs `processDueJobs()` — publishes/unpublishes content whose `ScheduledJob` time has arrived. |
| `/api/cron/link-check` | GET | Bearer `CRON_SECRET` | Runs `runLinkCheck("cron")` — internal/external broken-link + redirect-issue scan. |
| `/api/cron/seo-audit-scan` | GET | Bearer `CRON_SECRET` | Runs `runSeoAudit("cron")` — the technical SEO audit. |
| `/api/cron/content-health-scan` | GET | Bearer `CRON_SECRET` | Runs `runHealthScan()` — content health scoring. |
| `/api/cron/content-refresh-scan` | GET | Bearer `CRON_SECRET` | Runs `runRefreshScan(null)` directly rather than the permission-gated action, since a cron request has no session to check. |
| `/api/cron/content-recommendations-scan` | GET | Bearer `CRON_SECRET` | Runs `runRecommendationScan()` — internal-linking/content-gap suggestions. |
| `/api/cron/content-cannibalization-scan` | GET | Bearer `CRON_SECRET` | Runs `runCannibalizationScan()` — keyword-cannibalization detection across content. |
| `/api/cron/orphan-pages-scan` | GET | Bearer `CRON_SECRET` | Runs `runOrphanPageScan()`. |
| `/api/cron/backup-report` | POST | Bearer `CRON_SECRET` | **Reported into, not triggered from.** The actual `pg_dump` + R2 upload runs in `.github/workflows/db-backup.yml` (GitHub Actions, not this app) and POSTs its result here to populate the Backup dashboard. See `docs/runbooks/database-restore.md`. |
| `/api/cron/uptime-report` | POST | Bearer `CRON_SECRET` | Same pattern — the actual uptime probe runs in `.github/workflows/uptime-check.yml`, outside Cloudflare, since a probe running *inside* the Worker can't detect the Worker itself being down. |

All `/api/cron/*` routes return `{ error: "Not configured" }` (500) if
`CRON_SECRET` isn't set in the environment, rather than silently treating a
missing secret as "no auth required" — a configuration bug can never turn
into an open endpoint.

**Open question flagged, not fixed here:** `google/connect` and
`google/callback` check `session.user.role !== "ADMIN"` literally, not
`hasPermission(session.user.role, "INTEGRATION_MANAGEMENT")` the way
`app/(admin)/actions/google.ts` does for the rest of Google integration
management. Per `lib/permissions.ts`, `INTEGRATION_MANAGEMENT` is actually
**SUPER_ADMIN-only** — so as written, a `SUPER_ADMIN` is blocked from
`/api/google/connect` (redirected to `/login`) while a plain `ADMIN` (which
doesn't hold `INTEGRATION_MANAGEMENT` at all) is let through. This looks like
a mismatch between the route check and the permission model rather than an
intentional restriction — worth a decision, not a guess, before changing it.

## Server Actions — the real API surface

Organized by file under `app/(admin)/actions/`. Every mutating action (and
most reads) opens with `requireSession()` or `requirePermission(<perm>)` from
`lib/auth-guard.ts` — see `docs/admin-roles.md` for what those do and
`docs/permission-matrix.md` for the full permission table. Return shape is
almost universally `{ success: boolean; error?: string; ...data }` for
mutations and a bare array/object (or `[]`/`null` on failure, logged via
`console.error`) for reads — actions don't throw across the client boundary.

### Content CRUD (Posts, Pages, Case Studies, Services)

- **`posts.ts`**: `getPosts`/`getPost` (read) · `createPost`/`updatePost` (`CREATE`/`EDIT`) · `deletePost` (`DELETE`) · `transitionPost` (workflow — permission depends on the transition, see `docs/cms-workflow.md`).
- **`pages.ts`**, **`cases.ts`**, **`services.ts`**: identical shape to `posts.ts` (`get*`, `create*`/`update*`, `delete*`, `transition*`).
- **`bulk-posts.ts`**: `bulkChangeStatus`, `bulkSchedule`, `bulkAssignCategory`, `bulkAssignTags`, `bulkReassignAuthor`, `bulkUpdateSeo` — all `EDIT`, all operate on up to `MAX_BULK_SELECTION = 200` post ids at once via `Promise.all` of independent per-item calls (see `lib/prisma.ts`'s transaction-adapter comment for why, and `docs/known-limitations.md`), with partial success reported per item rather than all-or-nothing.
- **`taxonomy.ts`**: `getCategories`/`createCategory`/`deleteCategory`, `getTags`/`createTag`/`deleteTag` — `CREATE`/`DELETE`.

### CMS workflow, scheduling, versioning, locking

- **`workflow.ts`**: `getContentApprovalHistory` (read), `assignContentUser`, `setContentReviewDeadline`, `submitSeoReview` — thin wrappers over `lib/workflow.ts` (see `docs/cms-workflow.md`).
- **`scheduling.ts`**: `scheduleContentJob`, `cancelContentScheduledJob`, `getContentScheduledJobs`.
- **`versioning.ts`**: `getContentVersionHistory`, `compareContentVersions`, `restoreContentVersion`.
- **`content-lock.ts`**: `acquireContentLock`, `takeOverContentLock`, `heartbeatContentLock`, `releaseContentLock` — prevents two editors silently overwriting each other on the same Post/Page/CaseStudy.
- **`content-search.ts`**: `searchAllContent`, `getContentSearchFacets` — the admin global search.
- **`dependencies.ts`**: `checkContentDependencies` — "what else references this before I delete it" (categories/tags/redirects/etc.).

### AI Content Pipeline

- **`content-pipeline.ts`**: one action per pipeline stage (`advanceSearchIntentAction` → `advanceResearchAction` → `advanceOutlineAction` → `advanceDraftAction` → `advanceImageAction`/`skipImageStageAction` → `advanceSeoAction` → `advanceInternalLinksAction` → `advanceSchemaAction` → `advanceQaAction` → `approveRunAction` → `publishRunAction`), plus run/job management (`createPipelineRunAction`, `getPipelineRunsAction`, `retryJobAction`, `getAllJobsAction`, `getCostSummaryAction`) and the prompt library (`listPromptTemplatesAction`, `savePromptVersionAction`, `activatePromptVersionAction`). Full detail: `docs/runbooks/ai-content-pipeline.md` and `docs/ai-workflow.md`.
- **`brand-kb.ts`**: `listBrandSectionsAction`, `saveBrandSectionVersionAction`, `activateBrandSectionVersionAction` — the brand knowledge base the pipeline's prompts draw on.

### SEO system

- **`keywords.ts`**: tracked-keyword CRUD + `runRankCheck`/`refreshKeywordMetrics` (DataForSEO) + competitor domains — all `SEO_MANAGEMENT`.
- **`redirects.ts`**: CRUD + `getRedirectDiagnostics` + `bulkImportRedirects` — `SEO_MANAGEMENT`.
- **`link-graph.ts`** / **`topic-clusters.ts`** / **`link-monitor.ts`**: `getInternalLinkGraphAction`, `getTopicClustersAction`, `getLinkMonitorData`/`runLinkCheckNow` — `SEO_MANAGEMENT`.
- **`orphan-pages.ts`**, **`content-health.ts`**, **`content-recommendations.ts`**, **`content-cannibalization.ts`**: each follows `scanAndUpsert*Action` (run the scan) + `list*Action` (read results) + `dismiss*Action`/`markResolvedAction`.
- **`seo-audit.ts`** / **`seo-audits.ts`**: technical audit (broken links, NAP consistency, Core Web Vitals-adjacent checks) — note there are two files; `seo-audit.ts` is the older synchronous check set, `seo-audits.ts` wraps the cron-driven `SeoAuditRun` history.
- **`seo-experiments.ts`**: `createSeoExperimentAction`, `launchSeoExperimentAction`, `evaluateSeoExperimentAction`, `revertSeoExperimentAction` — the SEO A/B-test-like experimentation system.
- **`seo-change-log.ts`**: `getSeoChangeLogAction`, `getChangeImpactAction` — ties a logged SEO-relevant change to its before/after traffic impact.
- **`seo-performance-feedback.ts`**: `scanAndUpsertPerformanceFeedbackAction`, `listPerformanceFeedbackAction`, `dismissPerformanceFeedbackAction`.
- **`canonical-hreflang.ts`**: `getCanonicalHreflangReport`.
- **`gsc-import.ts`** / **`ga4-import.ts`**: `runGscImport`/`runGa4Import` (`SEO_MANAGEMENT`, calls `lib/gsc-import.ts`/`lib/ga4-import.ts`) + `getGscData`/`getGa4Data` (read, filtered).
- **`programmatic-seo.ts`**: pSEO template/dataset CRUD, `uploadPSeoDataset`, `runPSeoGeneration`, `overridePSeoPage` — `CREATE`/`EDIT`/`DELETE`.
- **`locations.ts`** / **`locationFaqs.ts`**: Local SEO location pages + their FAQs — `CREATE`/`EDIT`/`DELETE`.
- **`serviceFaqs.ts`**: same shape as `locationFaqs.ts`, for Service pages.

### Integrations & automation

- **`integrations.ts`**: `listIntegrationStatusesAction`, `getProviderFieldDefsAction`, `saveIntegrationCredentialsAction`, `testIntegrationAction`, `disconnectIntegrationAction` — the Integration Hub (Google Business Profile, Meta, CRM, Slack, WordPress, Webhooks); credentials encrypted with `INTEGRATION_ENCRYPTION_KEY` (see `lib/integrations/`).
- **`automation.ts`**: automation rule CRUD (`createAutomationRuleAction`, etc.), `listAutomationRunsAction`, `approveAutomationStepAction`/`rejectAutomationStepAction` (human-in-the-loop gate on an automated action), `runAutomationRuleManuallyAction`, `listSocialDraftsAction`/`dismissSocialDraftAction`.
- **`google.ts`**: `getGoogleIntegration`, `disconnectGoogle`, `updateGoogleConfig` — the GSC/GA4 connection's config side (the OAuth handshake itself is the two `app/api/google/*` routes above).

### Site content (non-CMS-workflow)

- **`faqs.ts`**, **`testimonials.ts`**, **`partners.ts`**, **`systems.ts`**, **`pricing.ts`**: plain CRUD, no approval workflow — `CREATE`/`EDIT`/`DELETE`.
- **`media.ts`**: `getMediaAssets`/`getMediaAsset`/`getMediaFolders` (read), `uploadMediaAsset`, `updateMediaMetadata`, `replaceMediaAsset`, `deleteMediaAsset` — all `MEDIA_MANAGEMENT`, backed by Cloudinary (`lib/cloudinary.ts`).
- **`translations.ts`**: `saveTranslationDraft`, `publishTranslation`/`unpublishTranslation`/`deleteTranslation`, plus read helpers for the translation-coverage UI.
- **`booking.ts`**: public `getAvailableSlots`/`createBooking` (no auth — see `docs/known-limitations.md` for the race-condition handling) + admin `getAllSlots`/`createSlot`/`createSlotsBulk`/`deleteSlot`/`getBookings`/`cancelBooking` (`CREATE`/`DELETE`/`EDIT`).
- **`forms.ts`**: public `submitContactForm` (rate-limited per email, no auth) + admin `getLeads`/`markLeadAsRead` (`USER_MANAGEMENT` — yes, leads are gated behind the same tier as user management, not `EDIT`; see `docs/permission-matrix.md`).

### Admin/ops

- **`admins.ts`**: `getAssignableUsers` (session only — any authenticated user can see who's eligible for a reviewer role), `getAdmins`/`createAdmin`/`updateAdminRole`/`deleteAdmin` (`USER_MANAGEMENT`, further scoped by `canManageUserWithRole` — see `docs/admin-roles.md`).
- **`profile.ts`**: `getCurrentAdmin`, `updateProfile`, `changePassword` — session only, acts on the caller's own account.
- **`security.ts`**: 2FA setup/disable/backup codes, session list/revoke, login history (`getMyLoginHistory` session-only, `getAllLoginHistory` `USER_MANAGEMENT`). See `docs/runbooks/security.md`.
- **`settings.ts`**: `updateSiteSettings`, `generateIndexNowKey` — `SETTINGS_MANAGEMENT`.
- **`monitoring.ts`**: `getMonitoringData` — `SETTINGS_MANAGEMENT`.
- **`observability.ts`**: `getObservabilityDataAction` — slow queries, error log, etc. (see `docs/monitoring.md`).
- **`technical.ts`**: `getWebVitalsSummary`, `getRecentFailedLogins`, `checkTlsCertificate` — `SETTINGS_MANAGEMENT`.
- **`audit.ts`**: `getAuditLogs`, `deleteAuditLog`, `purgeAuditLogsBefore`.
- **`executive-analytics.ts`**: `getExecutiveAnalyticsAction(days)`.
- **`import-export.ts`**: `export*`/`import*` per content type, `getImportExportCounts` — all `EXPORT`.
- **`seo.ts`**: `logNotFound` — tiny, logs a 404 hit for the SEO 404 report.
