# TBJ Client Hub (client Android app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the client Android app (`com.tbjgrowthtech.app`) from a website wrapper into an app-mode client portal at `/portal`: existing clients sign in with an emailed code, see their projects, updates, approvals, reports, invoices and meetings, and get push notifications. Staff manage it all from a new **Clients** section in `/admin`. No public website pages inside the app.

**Spec:** `docs/superpowers/specs/2026-11-22-client-hub-app-design.md` (assumptions in it are decided). Builds on the push and mobile work in branch `app`: verify `lib/push/*`, `PushDevice`, `NativeAppBridge`, the `mobile/` flavors and the R2 `APP_BUILDS` binding exist on the base branch before starting.

**Architecture:** Clients are a separate identity (`ClientUser`), never a staff `User` role, with their own signed session cookie and secret. All portal data access goes through one tenancy layer that takes `clientId` from the session only. The portal is plain Next.js pages and Server Actions under `/portal`, loaded by the Capacitor client flavor (`server.url` = `/portal`). Files live in a private R2 bucket served through an authenticated route. Push reuses `lib/push/*`, extended for client users.

**Tech Stack:** Next.js 16 App Router on Cloudflare Workers (OpenNext), Prisma 7 + Neon HTTP, `jose` (JWT, Workers-compatible), Resend, node:test, Capacitor 8 (existing).

## Global Constraints

- Staff and client auth never mix: no `CLIENT` value in the Prisma `Role` enum, no client in `ALL_ROLES`, a client cookie never satisfies `/admin`, and a staff NextAuth token never satisfies `/portal`.
- Every portal query is scoped by `clientId` taken from the verified session, never from request input. No portal function exists that doesn't take a `ClientContext`.
- Login is invite-only and passwordless: 6-digit code, stored hashed (HMAC with `CLIENT_SESSION_SECRET`), 10-minute expiry, max 5 attempts per code, max 5 codes per email per hour. The response is identical whether or not the email exists.
- Client sessions: 90 days, stored in `ClientSession` (revocable), cookie `tbj_client_session` (`httpOnly`, `secure`, `sameSite=lax`, `path=/`). Middleware only verifies the JWT signature and expiry (Edge); `requireClient()` also checks `ClientSession.revokedAt` on every Server Action and portal page.
- New `"use server"` functions carry the `// auth-check:` convention and `npm run check:actions` must recognise `requireClient()` as well as `requireSession()`/`requirePermission()`.
- Neon HTTP: no `$transaction`, no multi-statement batches; keep writes single-statement or order them so a failure between statements leaves valid data (see `docs/known-limitations.md`).
- Files (reports, invoices, attachments) live in a **private** R2 bucket `tbj-client-files` bound as `CLIENT_FILES`, served only by `/api/portal/files/[id]` (client, scoped to their `clientId`) and `/api/admin/client-files/[id]` (staff with `CLIENT_MANAGEMENT`). Never a public URL.
- Push text is generic and contains no names, amounts, invoice numbers or project titles. Tapping a push opens a `/portal/...` path validated by `safePortalPath()`.
- Money is stored as integer minor units plus an ISO currency code (BDT, GBP). No payment processing in this version.
- New portal pages: `noindex`, no links to public site pages, safe-area aware, usable at 360px, 44px tap targets, inputs at least 16px.
- Strings: English and Bangla, kept in `lib/portal/strings.ts` (en, bn). Language choice is per `ClientUser`.
- Nothing in `mobile/` enters the web build (already excluded). Do not touch TBJ Admin behaviour.
- Migration order (from `docs/deployment.md`): the migration is applied to production **before** the code that uses it is deployed. Never run `migrate dev` or `db push` against production.

- `20261122000000_add_client_hub` is already applied to the Neon database (2026-11-22, kept by decision). Never edit it: any further schema change goes in a new migration.

## Review Focus

1. **Tenancy:** client A can never read or change anything of client B. Test per resource: Task 4, `tenancy: <resource> is scoped to the session client`.
2. **Auth separation:** a client cookie gets nothing at `/admin`, a staff token gets nothing at `/portal`: Task 3.
3. **Code brute force and enumeration:** Task 2, `wrong code 5 times locks the code`, `unknown email gets the same response`.
4. **File access:** no file is readable without a matching session and `clientId`: Task 7.
5. **Push content and routing:** no personal data in payloads; `safePortalPath` rejects external and `/admin` paths: Task 10.
6. **Staff leakage:** staff-only fields (internal notes) never appear in any portal query: Task 4.

## Checkpoints (stop and let the user review)

After Task 4 (foundation), after Task 7 (admin side complete), and at the end. Run the fresh reviewer at each stop.

---

### Task 1: Data model and migration

**Files:**
- Modify: `prisma/schema.prisma`, `lib/permissions.ts` (add `CLIENT_MANAGEMENT`: SUPER_ADMIN and ADMIN; EDITOR gets it only through a narrower `CLIENT_UPDATES` permission for posting updates and reports; no one else), `docs/database-schema.md`, `docs/permission-matrix.md`
- Create: `prisma/migrations/20261122000000_add_client_hub/migration.sql`
- Test: `tests/permissions-client.test.ts`

**Models** (write proper Prisma, one field per line; names are the contract for later tasks):
- `Client` (id, name, accountManagerId → `User?`, whatsapp?, phone?, notes (staff-only), createdAt)
- `ClientUser` (id, clientId, email unique, name, language `en|bn`, status `INVITED|ACTIVE|DISABLED`, lastLoginAt?, deletionRequestedAt?)
- `ClientSession` (id, clientUserId, userAgent?, ip?, createdAt, lastSeenAt, revokedAt?)
- `ClientLoginCode` (id, email, codeHash, expiresAt, attempts, consumedAt?, createdAt)
- `Project` (id, clientId, title, description?, status `NOT_STARTED|IN_PROGRESS|WAITING_ON_CLIENT|COMPLETED`, progress Int 0–100, startDate?, dueDate?, createdAt)
- `ProjectMilestone` (id, projectId, title, dueDate?, doneAt?, order)
- `ProjectUpdate` (id, projectId, authorId → `User?` (null for system updates), kind `MANUAL|MILESTONE|APPROVAL`, body, createdAt, internalNote? never exposed); `Project.lastUpdateNudgeAt DateTime?` (for the stale-project reminder in Task 10); `Project.updateIntervalDays Int?` (per-project override; null means use the global default)
- `ClientHubSetting` (singleton, id `"global"`: `updateReminderDays Int @default(7)`; 0 turns update reminders off; allowed range 0–60). Separate from `SiteSetting` so public-site settings stay untouched
- `ApprovalRequest` (id, projectId, title, description?, status `PENDING|APPROVED|CHANGES_REQUESTED`, response?, respondedById → `ClientUser?`, respondedAt?, createdAt)
- `Report` (id, clientId, projectId?, period, title, summary?, metrics Json? (up to 4 items `{label, value, change?}`, e.g. Traffic, Leads, Keyword position; entered by staff, never computed), fileKey, publishedAt?)
- `Invoice` (id, clientId, number, amountMinor Int, currency, status `DUE|PAID|OVERDUE|VOID`, issueDate, dueDate, fileKey?)
- `ClientRequest` (id, clientUserId, clientId, message, status `OPEN|DONE`, createdAt)
- `ProjectAttachment` (id, updateId, name, fileKey)
- Extend: `Booking.clientUserId String?`; `PushDevice.clientUserId String?` and `userId` made optional with a check that exactly one of the two is set (enforce in code and in the migration with a `CHECK`); new `PushEvent` values `CLIENT_PROJECT_UPDATE`, `CLIENT_APPROVAL_NEEDED`, `CLIENT_REPORT_READY`, `CLIENT_INVOICE_DUE`, `CLIENT_INVOICE_OVERDUE`, `CLIENT_MEETING_REMINDER`; new `ClientPushPreference (clientUserId, event, enabled)`.

- [ ] **Step 1: Write failing test** for the permission matrix: `CLIENT_MANAGEMENT` only for SUPER_ADMIN and ADMIN, `CLIENT_UPDATES` also for EDITOR, nothing for SEO_MANAGER and CONTRIBUTOR.
- [ ] **Step 2:** `npm test` fails. Implement the permission changes. `npm test` passes.
- [ ] **Step 3:** Update `schema.prisma`, hand-write the additive migration in the style of the existing ones, `npx prisma generate`. Confirm the migration applies cleanly to an empty local database (`npx prisma dev` throwaway, see `docs/deployment.md`).
- [ ] **Step 4:** `npm run build` passes (types for existing `Record<Role, …>` maps still hold).
- [ ] **Step 5: Commit:** `feat(clients): data model, migration and CLIENT_MANAGEMENT permission`

### Task 2: Client auth (emailed code, session)

**Files:**
- Create: `lib/portal/auth.ts` (code issue/verify, session create/verify/revoke, `requireClient()`), `lib/portal/session-cookie.ts` (jose sign/verify, Edge-safe), `app/(portal)/actions/auth.ts` (`requestLoginCode`, `verifyLoginCode`, `signOutClient`), `docs/environment-variables.md` (`CLIENT_SESSION_SECRET`)
- Modify: `lib/email.ts` (add `sendClientLoginCode`, `sendClientInvite`), `package.json` (`jose`)
- Test: `tests/portal-auth.test.ts`

**Interfaces:**
- `type ClientContext = { clientUserId: string; clientId: string; sessionId: string; language: "en" | "bn" }`
- `requireClient(): Promise<ClientContext>` throws/redirects to `/portal/login` for no, expired, revoked or disabled session.

- [ ] **Step 1: Write failing tests** (fake prisma and clock, same style as existing tests):
  - `issues a 6-digit code, stores only its hash, expires in 10 minutes`
  - `wrong code 5 times locks the code`
  - `a consumed code cannot be reused`
  - `unknown email gets the same response and sends nothing`
  - `more than 5 codes per email per hour are refused without revealing why`
  - `DISABLED client user cannot sign in`
  - `verify creates a ClientSession and a 90-day JWT bound to its id`
  - `requireClient rejects a revoked session even with a valid JWT`
  - `a staff NextAuth token is not accepted as a client session`
- [ ] **Step 2:** `npm test` fails. **Step 3:** implement. **Step 4:** `npm test` and `npm run check:actions` pass.
- [ ] **Step 5: Commit:** `feat(portal): passwordless client login with revocable sessions`

### Task 3: Portal shell, middleware and app-mode layout

**Files:**
- Create: `app/(portal)/portal/layout.tsx`, `app/(portal)/portal/login/page.tsx`, `app/(portal)/portal/page.tsx` (Home placeholder), `components/Portal/TabBar.tsx`, `components/Portal/PortalHeader.tsx`, `lib/portal/strings.ts`, `lib/portal/paths.ts` (`safePortalPath`)
- Modify: `middleware.ts` (gate `/portal/**` except `/portal/login`; add `/portal` to the locale-exempt prefixes), `components/theme-provider.tsx` (treat `/portal` like staff prefixes if it gates theming), `app/robots.txt` (Disallow `/portal`)
- Test: `tests/portal-middleware.test.ts`, `tests/portal-paths.test.ts`

Tab bar: Home, Projects, Reports, Billing, More. Portal layout has no link to any public page. External links (WhatsApp, `tel:`, `mailto:`) are the only way out.

- [ ] **Step 1: Write failing tests.** Extract the gate decision into a pure function and test: no cookie at `/portal/x` redirects to `/portal/login`; invalid or expired cookie redirects; valid client cookie at `/admin/...` redirects to `/login` (no staff token); a staff NextAuth token at `/portal/x` redirects to `/portal/login`; `/portal/login` is open; `/portal` is never locale-rewritten; `safePortalPath` accepts `/portal/projects/1`, rejects `/admin`, `//evil.com`, `https://x`, `javascript:` and `undefined`.
- [ ] **Step 2:** fail. **Step 3:** implement. **Step 4:** pass; `npm run build` passes and `/portal/login` renders at 360px with the TBJ brand tokens (screenshot check).
- [ ] **Step 5: Commit:** `feat(portal): /portal shell, tab bar and auth gate`

### Task 4: Tenancy layer (checkpoint after this task)

**Files:**
- Create: `lib/portal/data.ts` (every read and write the portal needs, each taking `ClientContext`), `scripts/check-server-action-auth.mjs` (extend to accept `requireClient`)
- Test: `tests/portal-tenancy.test.ts`

Design rule: Prisma is used for portal data only inside `lib/portal/data.ts`; pages and actions call these functions. Selects are explicit lists, so `Client.notes` and `ProjectUpdate.internalNote` can't leak.

- [ ] **Step 1: Write failing tests** with two clients, A and B, each with projects, updates, approvals, reports, invoices, requests and meetings: for every function, `tenancy: <resource> is scoped to the session client` (A never reads B; A cannot respond to B's approval; A cannot fetch B's file key), and `no internal field is ever returned`.
- [ ] **Step 2:** fail. **Step 3:** implement the read functions now (projects, project detail, updates, milestones, approvals, reports, invoices) and the write functions stubbed with the same scoping (respond to approval, create request). **Step 4:** pass, `npm run check:actions` passes.
- [ ] **Step 5: Commit:** `feat(portal): tenancy-scoped data layer with isolation tests`

**CHECKPOINT: stop for review (foundation).**

### Task 5: Admin Clients: clients, users, invites

**Files:**
- Create: `app/(admin)/actions/clients.ts`, `app/(admin)/admin/clients/page.tsx`, `app/(admin)/admin/clients/[id]/page.tsx`, `components/Admin/Clients/*`
- Modify: `components/Admin/AdminSidebar.tsx` (Clients entry, visible with `CLIENT_MANAGEMENT`/`CLIENT_UPDATES`), `middleware.ts` (route-prefix gate for `/admin/clients`), `lib/audit-log.ts` usage for every mutation
- Test: `tests/clients-actions.test.ts`

Actions (all `requirePermission`, all audit-logged): create/update client, assign account manager, add client user (sends invite email with the portal URL and a first code), disable/enable, revoke all sessions, resend invite.

- [ ] **Step 1: Failing tests:** permission checks per role, invite sends exactly one email, disable revokes the user's sessions and push devices, audit entries written.
- [ ] **Step 2:** fail. **Step 3:** implement pages and actions (mobile-friendly like the existing admin pages). **Step 4:** pass; `npm run check:actions` passes.
Review notes carried from checkpoint 1:
- Resend invite and sign-in both issue codes, and verify only checks the newest one, so a client typing the code from the first email fails. Either say "use the newest email" in the invite copy or let verify accept any live unconsumed code for that email (each with its own attempt counter).
- `tests/helpers/fake-prisma.ts` treats `undefined` and `null` differently from Prisma (Prisma ignores `undefined` in `where`/`data`). Normalise or document it before the admin tests rely on it.

- [ ] **Step 5: Commit:** `feat(admin): Clients section with users and invites`

### Task 6: Admin: projects, milestones, updates, approval requests

**Files:**
- Create: `app/(admin)/actions/client-projects.ts`, `app/(admin)/admin/clients/[id]/projects/**`, `components/Admin/Clients/Project*.tsx`
- Test: `tests/client-projects-actions.test.ts`

Posting an update or an approval request calls `notifyClients(event, clientId, ...)` from Task 10; until Task 10 exists, call a no-op `lib/push/client-notify.ts` stub with the final signature so Task 10 only fills it in.

**Making updates easy to give (the real risk is staff forgetting, not missing features).** The update system must take staff under 30 seconds, from a phone:
- **Quick-post form:** a mobile-first form (body, optional project status change, optional attachment, "notify client" on by default) that works well inside the TBJ Admin app. Reachable in two taps from the Clients list and from a project page.
- **Templates:** a small fixed list in code (not a table) that prefills the body, e.g. "Design draft ready for your review", "Content received, work started", "Staging link ready", "Delivered". Staff can edit the text before posting.
- **System updates (automatic):** completing a milestone posts a `MILESTONE` update ("Milestone completed: {title}"); creating an approval request and the client's response post `APPROVAL` updates. These appear in the client's feed so it never looks empty, and notify at most once per project per hour (collapse bursts).
- **Configurable interval (no hard-coded 7):** the number of days is set by admins (`CLIENT_MANAGEMENT`) in a small "Update reminders" setting on the Clients overview (default 7, 0 = off), and can be overridden per project in the project form (e.g. 3 for a launch week, 14 for a slow retainer; empty = use the default). One helper `getUpdateIntervalDays(project, settings)` is the only place that decides; the stale list and the Task 10 cron both use it. Changing a value is audit-logged.
- **Stale-project list:** the Clients overview shows "Projects needing an update" (active projects with no update within their interval). The nudge push/email comes in Task 10.

- [ ] **Step 1: Failing tests:** `EDITOR can post updates but cannot create or delete projects`, `internal notes are stored but never selected by portal queries`, `approval request starts PENDING and sets the project to WAITING_ON_CLIENT`, `completing all milestones does not auto-complete the project` (explicit staff action only), `completing a milestone creates one MILESTONE update`, `rapid milestone completions notify the client once per hour`, `quick-post with notify off stores the update without a push`, `stale list contains only active projects with no update within their interval`, `per-project interval overrides the global default`, `interval 0 disables the stale list and nudges for that scope`, `interval outside 0–60 is rejected`, `only CLIENT_MANAGEMENT can change the global interval`.
- [ ] **Step 2:** fail. **Step 3:** implement. **Step 4:** pass; check the quick-post form at 360px inside the admin app.
- [ ] **Step 5: Commit:** `feat(admin): client projects, milestones, updates and approval requests`

### Task 7: Admin: reports, invoices and private file storage (checkpoint after this task)

**Files:**
- Create: `app/(admin)/actions/client-files.ts`, `app/api/portal/files/[id]/route.ts`, `app/api/admin/client-files/[id]/route.ts`, `lib/portal/files.ts`, admin pages for reports and invoices under `app/(admin)/admin/clients/[id]/`
- Modify: `wrangler.jsonc` (R2 binding `CLIENT_FILES` → bucket `tbj-client-files`), `docs/deployment.md` (create the bucket before deploying; the deploy fails without it)
- Test: `tests/client-files.test.ts`

Upload goes through a Server Action (`FormData`, PDF/PNG/JPG only, size limit 20 MB), stores the object under `clients/{clientId}/{uuid}`, and records only the key. Downloads set `Content-Disposition` and `Cache-Control: private, no-store`.

Monthly report form: period, title, short summary, up to 4 headline numbers (label, value, optional change such as "+12%"), and the PDF. Staff types the numbers by hand; there is no live analytics integration in v1 (a later version can read `TrackedKeyword` for keyword positions). Out of scope for this whole plan: time tracking and hours, task-by-task ticket lists, live analytics graphs, clients creating tasks.

- [ ] **Step 1: Failing tests:** `report metrics accept at most 4 items and reject non-text labels`, `client A cannot download client B's file (404, not 403)`, `no session gets 401`, `staff without CLIENT_MANAGEMENT cannot download`, `rejects non-allowed content types and oversize files`, `draft (unpublished) reports are not visible to the client`.
- [ ] **Step 2:** fail. **Step 3:** implement. **Step 4:** pass; `npm run build:cloudflare` bundles the new routes for workerd.
Review note carried from checkpoint 1: `Report.projectId` isn't constrained to the report's client by the schema. The admin report action must reject a project of another client, and `lib/portal/data.ts` must not expose a mismatched project (test: `a report can't link another client's project`).

- [ ] **Step 5: Commit:** `feat(clients): reports, invoices and authenticated private file serving`

**CHECKPOINT: stop for review (admin side complete).**

### Task 8: Portal: Home, Projects, project detail, approvals

**Files:**
- Create/Modify: `app/(portal)/portal/page.tsx`, `app/(portal)/portal/projects/**`, `app/(portal)/actions/approvals.ts`, `components/Portal/*` (StatusChip, MilestoneTimeline, UpdateFeed, ApprovalCard)
- Test: `tests/portal-approvals.test.ts`

Home shows active projects with status chip and progress, a "Waiting on you" block (pending approvals), the next meeting, and the latest update. Approve and Request changes (comment required for changes) write an audit-log entry and update the project status.

- [ ] **Step 1: Failing tests:** `approve sets APPROVED, stamps respondedBy and time`, `cannot respond twice`, `request changes requires a comment`, `responding is scoped to the session client`, `audit log entry is written`.
- [ ] **Step 2:** fail. **Step 3:** implement with the app-mode design (cards, large chips). **Step 4:** pass; screenshot every screen at 360px (en and bn).
Review notes carried from checkpoint 1:
- `respondToApproval` must reject any decision other than `APPROVED`/`CHANGES_REQUESTED` at runtime (Zod), not only by type.
- Make its "only while PENDING" write one atomic statement (raw `UPDATE … WHERE status = 'PENDING' RETURNING`), like the login-code claim, so two parallel responses can't both win.

- [ ] **Step 5: Commit:** `feat(portal): home, projects, updates and approvals`

### Task 9: Portal: Reports, Billing, More (meetings, contact, requests, profile)

**Files:**
- Create/Modify: `app/(portal)/portal/{reports,billing,more}/**`, `app/(portal)/actions/{requests,profile,booking}.ts`, `app/(admin)/admin/clients/requests/page.tsx` (staff inbox for `ClientRequest` and account-deletion requests)
- Test: `tests/portal-more.test.ts`

Reports tab: a list by month; each report opens to its summary and the headline numbers as large tiles above a "Download PDF" button.

More contains: meetings (upcoming list; book a call reusing `AvailableSlot`/`Booking`, setting `Booking.clientUserId` and prefilling name and email), contact (WhatsApp and call buttons for the client's account manager from `Client.whatsapp`/`phone`), send a request (creates `ClientRequest`, emails staff), notification preferences, language, sign out, "request account deletion" (sets `deletionRequestedAt` and notifies staff; actual deletion is a manual staff action in v1).

- [ ] **Step 1: Failing tests:** `booking links the client user and prefills`, `a client cannot book a taken slot` (the existing unique `slotId` still protects), `request is created for the session client only`, `deletion request is recorded and staff are emailed`, `language change persists`.
- [ ] **Step 2:** fail. **Step 3:** implement. **Step 4:** pass; screenshots at 360px (en and bn).
- [ ] **Step 5: Commit:** `feat(portal): reports, billing, meetings, contact, requests and profile`

### Task 10: Push for clients and reminder cron

**Files:**
- Modify: `lib/push/recipients.ts` (client recipients by event with `ClientPushPreference` defaults all on), `lib/push/messages.ts` (generic client copy), `lib/push/client-notify.ts` (fill in the Task 6 stub), `app/(admin)/actions/push.ts` (+ `app/(portal)/actions/push.ts`: `registerClientPushDevice`, `unregisterClientPushDevice`, `setClientPushPreference`), `lib/portal/auth.ts` (sign-out and revoke delete the client's push devices, wrapped in try/catch so a push-table problem never blocks sign-out), `lib/portal/paths.ts`
- Create: `app/api/cron/client-reminders/route.ts` (bearer `CRON_SECRET`; sends meeting reminders about 24 h and 1 h ahead, marks invoices `OVERDUE` after the due date and notifies once; also nudges the project's account manager, by staff push and email, when an active project has had no update within its interval (`getUpdateIntervalDays`, default 7, configurable globally and per project), at most once per interval using `Project.lastUpdateNudgeAt`), entry in `.github/workflows/app-cron.yml`
- Test: `tests/push-client.test.ts`

Copy (exact): "Project update" / "There is a new update on your project." → `/portal/projects`; "Your approval is needed" / "Open the app to review." → `/portal`; "Report ready" / "A new report is available." → `/portal/reports`; "Invoice due" / "You have an invoice to review." → `/portal/billing`; "Meeting reminder" / "You have an upcoming meeting." → `/portal/more`.

- [ ] **Step 1: Failing tests:** `payloads contain no names, amounts, titles or invoice numbers`, `only the target client's devices are notified`, `sign-out and disable delete that client's devices`, `reminder cron is idempotent (no double reminders)`, `overdue transition notifies once`, `stale-project nudge goes to the account manager only, once per interval, never to the client, and respects a changed interval`, `safePortalPath rejects /admin and external urls`, `push failure never breaks posting an update`.
- [ ] **Step 2:** fail. **Step 3:** implement. **Step 4:** pass; `npm run check:actions` passes; `npm run build:cloudflare` passes.
Review notes carried from checkpoint 1:
- `PushDevice` has a CHECK that exactly one of `userId`/`clientUserId` is set. The staff `registerPushDevice` upsert must set `clientUserId: null` on update, and `registerClientPushDevice` must set `userId: null` and `adminSessionId: null`, or a token moving between apps fails the constraint.
- A push tap opens a `/portal/...` path; if the session has expired, middleware sends the client to `/portal/login` without `?from=`, so they land on Home. Pass `from` (validated by `safePortalPath`) through the redirect.
- `check:actions`: accept `requireClient` only in `app/(portal)/actions/**` and `requireSession`/`requirePermission` only outside it.
- Never use `x-forwarded-for` for any IP-based limit (client-controlled); only `cf-connecting-ip`.

- [ ] **Step 5: Commit:** `feat(push): client notifications and meeting/invoice reminder cron`

### Task 11: Client app flavor to app mode

**Files:**
- Modify: `mobile/` client flavor config (`server.url` → `https://tbjgrowthtech.com/portal`; keep the same package ID `com.tbjgrowthtech.app`; custom user-agent suffix `TBJClientApp`), `mobile/android/app/src/client/AndroidManifest.xml` (restore `POST_NOTIFICATIONS` and biometric permission), `components/Admin/NativeAppBridge.tsx` → generalise into a shared bridge with an `isClientApp()`/`isAdminApp()` split (`lib/native.ts`), `middleware.ts` (when the `TBJClientApp` user agent requests a non-`/portal` page, redirect to `/portal`), `app/(public)/[locale]/app/page.tsx` (copy: "For TBJ clients: track your project"), `docs/deployment.md`, `mobile/README.md`
- Test: `tests/native-client-app.test.ts`

Client app bridge: register push for the signed-in client (`registerClientPushDevice`), hardware back, optional biometric lock after 5 minutes (setting in More), offline screen. Bump `versionCode` to 2 and `versionName` to `1.1.0`; the package ID and signing key stay the same.

- [ ] **Step 1: Failing tests:** `isClientApp is true only with the TBJClientApp user agent`, `client app never registers staff push and admin app never registers client push`, `middleware redirects the client app away from public pages but not from /portal or /api/portal`, `safePortalPath is used for push navigation`.
- [ ] **Step 2:** fail. **Step 3:** implement. **Step 4:** pass; build both APKs (`./gradlew --no-daemon --max-workers=2 assembleClientRelease assembleAdminRelease`) and verify with `apksigner verify --print-certs` (SHA-256 must match `mobile/README.md`); `aapt dump badging` shows notification and biometric permissions on both flavors.
- [ ] **Step 5: Commit:** `feat(mobile): client app opens the portal with push and app lock`

### Task 12: Runbook and pilot checklist (user-run)

**Files:**
- Modify: `docs/deployment.md`, `mobile/README.md`

- [ ] **Step 1:** Document, in order: (1) back up the database branch and apply the pending Client Hub migrations (`20261122000000_add_client_hub` is already applied as of 2026-11-22; later ones such as `20261123000000_client_hub_notify_throttle` are not; check `migrate status` first); (2) create the private R2 bucket `tbj-client-files`; (3) set the Worker secret `CLIENT_SESSION_SECRET` (random 32+ bytes); (4) deploy; (5) create a test client and user in `/admin/clients`; (6) upload the new client APK to `tbj-downloads/tbj-growth-tech.apk` and bump `NEXT_PUBLIC_ANDROID_APP_VERSION` to `1.1.0`.
- [ ] **Step 2: Real-phone checklist:**
  - Invite a test client; the code email arrives; sign in on the phone; stay signed in after closing the app.
  - Home, Projects, Reports, Billing, More all render at 360px in en and bn.
  - Staff posts an update: push arrives, generic text, tap opens `/portal/projects`.
  - Staff requests approval: client approves; staff sees the response and the audit entry.
  - Client A cannot see client B's anything (use two test clients on two phones or two sessions).
  - A client session cannot open `/admin`; a staff session cannot open `/portal`.
  - Disable the client user: the app signs out and stops receiving push.
  - Book a call from More; the booking appears in `/admin/booking` linked to the client.
  - Airplane mode shows the offline screen; external links open in the system browser.
- [ ] **Step 3: Commit:** `docs(clients): Client Hub release runbook and pilot checklist`
