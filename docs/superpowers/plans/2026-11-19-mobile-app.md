# TBJ Mobile App (PWA + Android Capacitor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship tbjgrowthtech.com (public site and `/admin`) as an installable PWA and as an Android APK, downloaded from the site, with push notifications to admins for new leads, bookings, and content awaiting approval.

**Architecture:** The web app gets a manifest plus a hand-written service worker that never touches `/admin`, `/login`, or `/api`. A Capacitor Android shell in `mobile/` loads the live origin in `server.url` mode, so Server Actions keep working same-origin. The remote page calls native plugins through the injected `window.Capacitor.Plugins` global, so the web bundle gets no Capacitor npm dependency. Push goes from the Worker straight to FCM HTTP v1 through `fetch`, with a service-account JWT signed by WebCrypto.

**Tech Stack:** Next.js 16 App Router on Cloudflare Workers (OpenNext), Prisma 7 + Neon HTTP, NextAuth v4 JWT, node:test, Capacitor 7 (Android), FCM HTTP v1.

**Spec:** `docs/superpowers/specs/2026-11-16-mobile-app-design.md`

## Global Constraints

- Android only. No iOS project or Apple-specific code. iPhone users get the PWA.
- Two Android apps from ONE `mobile/` Capacitor project (product flavors, same keystore):
  - `admin` flavor: `com.tbjgrowthtech.admin`, "TBJ Admin". Opens `https://tbjgrowthtech.com/admin`. Native push, biometric lock, and back button. Distributed only through `/admin/app`, an authenticated route that streams from a **private** R2 bucket.
  - `client` flavor: `com.tbjgrowthtech.app`, "TBJ Growth Tech". Opens `/`. No push or biometric (those permissions are stripped from its manifest). Distributed from the public `/app` page through public R2.
  - Build the Admin app first and the client app after. There is no "Staff login" link anywhere public or in the client app. IDs and names are permanent once installed.
- The release keystore lives **outside the repo** at `E:/others files/web files/TBJ-works/tbj-signing/tbj-release.jks`, next to `keystore.properties`. It is never committed. The user must back it up.
- The WebView loads `https://tbjgrowthtech.com` (apex only, from `wrangler.jsonc`). `allowNavigation` lists only that host. Every other host opens in the system browser.
- The service worker never caches or intercepts `/admin*`, `/login*`, `/api/*`, non-GET requests, or cross-origin requests.
- Push text contains no personal data (no name, email, phone, or message). Tapping a push opens an `/admin/...` path. Login is still required.
- Firebase is not set up yet. All push code reads `FCM_SERVICE_ACCOUNT_JSON` (the whole service-account JSON as a string). If it is missing, sending is a logged no-op and must never break a form submit.
- The client APK is hosted on Cloudflare R2 (public bucket on `downloads.tbjgrowthtech.com`). The URL comes from `NEXT_PUBLIC_ANDROID_APK_URL`, with the default `https://downloads.tbjgrowthtech.com/tbj-growth-tech.apk`. APK files are never committed. `*.apk` and `*.aab` go in `.gitignore`.
- Neon HTTP: no `$transaction`, no `updateMany` on hot paths that the adapter rejects (see `docs/known-limitations.md`). `deleteMany` is fine.
- New `"use server"` functions carry the `// auth-check:` convention and pass `npm run check:actions`.
- Nothing in `mobile/` may enter the web build: exclude it in `tsconfig.json` and `eslint.config.mjs`.

## Review Focus

1. **Logout or revoke on a phone:** the device must stop getting pushes. The test lives in Task 3, `revoke deletes push devices for that session`.
2. **Push failure while a visitor submits the contact form or books a call:** the visitor still sees success. The test lives in Task 4, `lead is saved and success returned when FCM throws`.
3. **Back-button or cached-page leak after logout:** no `/admin` HTML is ever in Cache Storage. The test lives in Task 1, `cachePolicy returns "bypass" for admin, login, api, POST, cross-origin`.
4. **Stale or uninstalled FCM tokens (UNREGISTERED/404):** the row is deleted and never retried. The test lives in Task 2, `unregistered token is reported for deletion`.
5. **Locale-prefixed public pages in the app (`/bn-bd/...`, `/ar-ae/...` RTL):** the download page and privacy page render under every prefix. This is checked manually in Task 6 step 4 and Task 7 step 4.

---

### Task 1: PWA foundation (manifest, icons, service worker)

**Files:**
- Create: `app/manifest.ts`, `public/sw.js`, `public/offline.html`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`, `public/icons/apple-touch-icon.png` (180), `components/ServiceWorkerRegister.tsx`, `scripts/generate-app-icons.mjs`
- Modify: `app/layout.tsx` (metadata `manifest`, `appleWebApp`, `icons.apple`, viewport `themeColor`), `app/(public)/[locale]/layout.tsx` (mount `<ServiceWorkerRegister />`)
- Test: `tests/sw-cache-policy.test.ts`

**Interfaces:**
- Produces: `public/sw.js` assigns `self.__cachePolicy = cachePolicy`, where `cachePolicy(url: URL, method: string, origin: string): "bypass" | "static" | "page"`. `/offline.html` is the fallback. Task 5 reuses it as the Capacitor `errorPath` copy.

- [ ] **Step 1: Write the failing test.** Load `public/sw.js` in `node:vm` with a stub `self` (that has `addEventListener` and `location.origin = "https://tbjgrowthtech.com"`) and `caches` stubs, then assert:
  - `bypass` for `/admin`, `/admin/leads`, `/login?from=x`, `/api/auth/session`, any method `POST`, and `https://www.google.com/x`.
  - `static` for `/_next/static/chunks/a.js`, `/icons/icon-192.png`, `/primarylogo.png`.
  - `page` for `/`, `/bn-bd/services/seo`, `/blog/hello`.
- [ ] **Step 2:** Run `npm test`. Expected: the test FAILS because `__cachePolicy` is undefined.
- [ ] **Step 3: Implement `public/sw.js`.**
  - Cache name `tbj-v1`. On `install`, precache `/offline.html` and the icons, then `skipWaiting`.
  - On `activate`, delete old caches and call `clients.claim`.
  - On `fetch`, apply the policy:
    - `bypass`: return without `respondWith`.
    - `static`: cache-first.
    - `page`: network-first; if offline, use the cached copy, then `/offline.html`.
  - Only cache `response.ok && response.type === "basic"`, and never a response that carries `Set-Cookie` or `Cache-Control: private/no-store`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Implement the rest of the PWA files.**
  - `app/manifest.ts`: `name: "TBJ Growth Tech"`, `short_name: "TBJ"`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, plus `theme_color` and `background_color` from the site's existing brand tokens. Icons are 192, 512, and maskable 512 with `purpose: "maskable"`.
  - Icons are generated from `public/primarylogo.png` by `scripts/generate-app-icons.mjs`. Install `sharp` as a devDependency for this.
  - `ServiceWorkerRegister` is a client component. It registers `/sw.js` only in production.
  - `offline.html` is self-contained with inline CSS and a Retry button.
- [ ] **Step 6: Verify.**
  - `npm run build` succeeds.
  - Run `next start`, open Chrome DevTools > Application: the manifest is valid with no errors and the SW is activated.
  - Visit `/admin` while logged in: Cache Storage contains no `/admin` or `/login` entry.
- [ ] **Step 7: Commit:** `feat(pwa): installable manifest, icons and service worker that never caches admin`

### Task 2: Push data model and FCM sender

**Files:**
- Modify: `prisma/schema.prisma` (add the models below, plus a `pushDevices` relation on `User` and `AdminSession`)
- Create: `prisma/migrations/20261119000000_add_push_devices/migration.sql`, `lib/push/fcm.ts`, `lib/push/messages.ts`
- Modify: `docs/environment-variables.md`, `docs/database-schema.md`
- Test: `tests/push-fcm.test.ts`

Schema:
```prisma
enum PushEvent { NEW_LEAD NEW_BOOKING CONTENT_AWAITING_APPROVAL }
model PushDevice {
  id String @id @default(cuid())
  userId String;  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  adminSessionId String?; adminSession AdminSession? @relation(fields: [adminSessionId], references: [id], onDelete: Cascade)
  platform String   // "android" | "web"
  token String @unique
  createdAt DateTime @default(now()); lastSeenAt DateTime @default(now())
  @@index([userId]) @@index([adminSessionId])
}
model PushPreference {
  userId String; user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  event PushEvent; enabled Boolean
  @@id([userId, event])
}
```

**Interfaces:**
- Produces:
  - `sendFcm(tokens: string[], msg: PushMessage): Promise<{ sent: number; invalidTokens: string[] }>` in `lib/push/fcm.ts`.
  - `type PushMessage = { title: string; body: string; url: string }`.
  - `PUSH_MESSAGES: Record<PushEvent, PushMessage>` in `lib/push/messages.ts`, with this exact copy:
    - `NEW_LEAD`: "New lead received" / "Open the admin panel to view it." / `/admin/leads`
    - `NEW_BOOKING`: "New call booked" / "A visitor booked a call. Open the admin panel for details." / `/admin/booking`
    - `CONTENT_AWAITING_APPROVAL`: "Content awaiting approval" / "A post was submitted for review." / `/admin/posts`

- [ ] **Step 1: Write failing tests.** Inject fake `fetch` and `Date.now`. Use a generated RSA key (`crypto.generateKeyPairSync`) and pass it in as the `FCM_SERVICE_ACCOUNT_JSON` env.
  - `signs an RS256 JWT and exchanges it at oauth2.googleapis.com/token once, reusing the access token until 60s before expiry`
  - `posts one message per token to https://fcm.googleapis.com/v1/projects/{project_id}/messages:send with notification {title, body} and data {url}`, with `android.priority: "high"`
  - `unregistered token is reported for deletion`: 404 or `UNREGISTERED`/`INVALID_ARGUMENT` puts the token into `invalidTokens`
  - `missing FCM_SERVICE_ACCOUNT_JSON returns {sent:0} without fetching`
- [ ] **Step 2:** Run `npm test`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `lib/push/fcm.ts`.** Import the PKCS8 PEM with `crypto.subtle.importKey("pkcs8", …, {name:"RSASSA-PKCS1-v1_5", hash:"SHA-256"})`. Use base64url helpers and a module-level token cache. Send with `Promise.allSettled`, at most 20 concurrent requests.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Write and apply the migration.**
  - Hand-write `migration.sql` in the style of the existing migrations.
  - Run `npx prisma generate` and `npx prisma migrate deploy` against the dev DB. Confirm with the user before running against production.
- [ ] **Step 6: Commit:** `feat(push): PushDevice/PushPreference models and FCM HTTP v1 sender`

### Task 3: Device registration, preferences, cleanup on logout/revoke

**Files:**
- Create: `app/(admin)/actions/push.ts`, `lib/push/recipients.ts`
- Modify: `lib/session-tracking.ts` (`revokeAdminSession`, `revokeAllOtherAdminSessions` delete matching `PushDevice` rows), `lib/auth.ts` (NextAuth `events.signOut`: `pushDevice.deleteMany({ where: { adminSessionId: token.sessionId } })`), `app/(admin)/admin/profile/...` (a "Notifications" card with one toggle per event the user is eligible for)
- Test: `tests/push-recipients.test.ts`, `tests/push-actions.test.ts`

**Interfaces:**
- Consumes: the Task 2 models and the `PushEvent` enum.
- Produces:
  - `eligibleEvents(role: Role): PushEvent[]`
    - `NEW_LEAD` requires `USER_MANAGEMENT`, because leads are already gated by it.
    - `NEW_BOOKING` is available to every role.
    - `CONTENT_AWAITING_APPROVAL` requires `APPROVE`.
  - `defaultEnabled(role: Role, event: PushEvent): boolean`. True for SUPER_ADMIN, ADMIN, and EDITOR. False for CONTRIBUTOR and SEO_MANAGER (spec §9ক).
  - `recipientTokens(event: PushEvent): Promise<string[]>` returns tokens whose user has the event eligible, has it enabled (explicit preference, else the default), and has `lastSeenAt` within 30 days. It deletes rows older than 30 days as a side effect.
  - Server actions:
    - `registerPushDevice({ token, platform }): Promise<{ success: boolean }>`: `requireSession()`. Upserts by token and sets userId, `adminSessionId = session.user.sessionId`, and `lastSeenAt`.
    - `unregisterPushDevice(token)`
    - `getPushPreferences()`
    - `setPushPreference(event, enabled)`: rejects an event that isn't eligible for the user's role.

- [ ] **Step 1: Write failing tests** (fake prisma, same pattern as `tests/lead-reply.test.ts`):
  - `CONTRIBUTOR is never a NEW_LEAD recipient even with an explicit enabled preference`
  - `EDITOR gets NEW_BOOKING and CONTENT_AWAITING_APPROVAL by default but not NEW_LEAD`
  - `SEO_MANAGER NEW_BOOKING defaults off, on after setPushPreference(true)`
  - `devices unseen for 30+ days are excluded and deleted`
  - `register re-assigns an existing token to the new user/session` (shared phone)
  - `revoke deletes push devices for that session`, and `revokeAllOther keeps the current session's device`
  - `registerPushDevice rejects unauthenticated calls`, and `setPushPreference rejects ineligible event`
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement the recipients, actions, cleanup hooks, and the profile Notifications card. The card shows "Install the Android app to receive notifications" when it's not running in the app.
- [ ] **Step 4:** Run `npm test` and `npm run check:actions`. Expected: all pass.
- [ ] **Step 5: Commit:** `feat(push): device registration, per-user preferences, cleanup on logout/revoke`

### Task 4: Trigger pushes from lead, booking, and review submission

**Files:**
- Create: `lib/push/notify.ts`
- Modify: `app/(admin)/actions/forms.ts` (after `sendContactNotification`), `app/(admin)/actions/booking.ts` (after `sendBookingNotification`), `lib/workflow.ts` (in `transitionContent` when `transition.to === "REVIEW"`, for submit and resubmit)
- Test: `tests/push-notify.test.ts`

**Interfaces:**
- Consumes: `recipientTokens`, `sendFcm`, `PUSH_MESSAGES`.
- Produces: `notifyAdmins(event: PushEvent): Promise<void>`. It never throws (it catches and logs), and it deletes `invalidTokens`. Callers schedule it with `after(() => notifyAdmins(...))` from `next/server`, so the visitor's response never waits on FCM.

- [ ] **Step 1: Write failing tests:**
  - `notifyAdmins swallows FCM errors`
  - `invalid tokens are deleted`
  - `lead is saved and success returned when FCM throws`: drive `submitContactForm` with a mocked `next/server` `after` that runs the callback immediately
  - `booking triggers NEW_BOOKING`
  - `submit transition triggers CONTENT_AWAITING_APPROVAL; approve does not`
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `notify.ts` and the three hooks.
- [ ] **Step 4:** Run `npm test`. Expected: PASS. Then run `npm run build:cloudflare` locally to confirm `after()` and WebCrypto bundle for workerd.
- [ ] **Step 5: Commit:** `feat(push): notify admins on new lead, booking and content submitted for review`

### Task 5: Capacitor project in `mobile/` with `admin` + `client` flavors, web-side native bridge

**Files:**
- Create:
  - `mobile/package.json`, with `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/push-notifications`, `@capacitor/app`, `@capacitor/splash-screen`, and `@aparajita/capacitor-biometric-auth` at the current majors.
  - `mobile/capacitor.config.ts`. Base values: `webDir: "www"`, `server.url: "https://tbjgrowthtech.com"`, `allowNavigation: ["tbjgrowthtech.com"]`, `errorPath: "offline.html"`, `android.allowMixedContent: false`.
  - `mobile/scripts/flavor-configs.mjs`. After `cap sync`, it writes `android/app/src/{admin,client}/assets/capacitor.config.json` from the synced main config. It overrides only `server.url` (`/admin` for admin, `/` for client), `appId`, and `appName`.
  - `mobile/www/index.html`, `mobile/www/offline.html`, `mobile/README.md`, and `mobile/android/` (generated).
  - Flavor sources: `android/app/src/admin/res/values/strings.xml` plus icons, `android/app/src/client/res/values/strings.xml` plus icons, and `android/app/src/client/AndroidManifest.xml`, which uses `tools:node="remove"` on `POST_NOTIFICATIONS`, `USE_BIOMETRIC`, and `USE_FINGERPRINT`.
  - `components/Admin/NativeAppBridge.tsx`, `lib/native.ts`.
- Modify:
  - `android/app/build.gradle`: `flavorDimensions "app"`, `admin { applicationId "com.tbjgrowthtech.admin" }`, `client { applicationId "com.tbjgrowthtech.app" }`, a shared `release` signingConfig, and the google-services plugin applied only if `google-services.json` exists.
  - `app/(admin)/layout.tsx`: mount `<NativeAppBridge />`.
  - `components/Admin/LogoutButton.tsx`: `await unregisterCurrentDevice()` before `signOut`.
  - `tsconfig.json` and `eslint.config.mjs`: exclude `mobile/**`.
  - `.gitignore`: `google-services.json`, `*.apk`, `*.aab`, `*.jks`, `keystore.properties`, `mobile/node_modules`, and Gradle/build outputs.
- Test: `tests/native-bridge.test.ts`

**Interfaces:**
- Consumes: `registerPushDevice` and `unregisterPushDevice` (Task 3).
- Produces, in `lib/native.ts`:
  - `isNativeApp(): boolean`
  - `nativePlugin<T>(name): T | null`, which reads `window.Capacitor?.Plugins`
  - `ADMIN_APP_ID = "com.tbjgrowthtech.admin"`
  - `isAdminApp(): Promise<boolean>`, true when `App.getInfo().id === ADMIN_APP_ID`
  - `safeAdminPath(url: unknown): string`, which returns the url only if it is a same-origin path starting with `/admin`, else `/admin`
- `NativeAppBridge` does nothing unless `await isAdminApp()` is true. Then it:
  - requests push permission and registers, calling `registerPushDevice({ token, platform: "android" })` and keeping the token in `localStorage["tbj-push-token"]`;
  - on `pushNotificationActionPerformed`, navigates to `safeAdminPath(data.url)`;
  - on hardware back, calls `history.back()` if possible, else `App.exitApp()`;
  - shows a biometric lock overlay when the app resumes after ≥ 5 minutes in the background. The overlay offers "Unlock" and "Sign in with password" (`signOut({ callbackUrl: "/login" })`). A failure keeps the lock and never revokes anything. The lock is skipped if the phone has no biometry.
- In the client app the bridge stays inert, even if someone opens `/admin`.

- [ ] **Step 1: Write failing tests:**
  - `safeAdminPath`: `/admin/leads` → itself. `https://evil.com/admin`, `//evil.com`, `/login`, `javascript:alert(1)`, and `undefined` → `/admin`.
  - `isNativeApp` is false without `window.Capacitor`.
  - `isAdminApp` is false when `App.getInfo` returns `com.tbjgrowthtech.app`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL. Implement `lib/native.ts`. Run `npm test` again. Expected: PASS.
- [ ] **Step 3:** Implement `NativeAppBridge`, the logout change, and the exclusions. `npm run build` and `npm run lint` pass.
- [ ] **Step 4: Scaffold the Admin app first.**
  - In `mobile/`: run `pnpm install`, `npx cap add android`, `npx cap sync android`, then `node scripts/flavor-configs.mjs`.
  - Add the flavors, the admin strings ("TBJ Admin"), and a visually distinct admin icon (dark background variant).
  - Set `versionCode 1` and `versionName "1.0.0"` per flavor.
  - Release signing reads `../../tbj-signing/keystore.properties` if present, else the env vars `TBJ_KEYSTORE_PATH`, `TBJ_KEYSTORE_PASSWORD`, `TBJ_KEY_ALIAS`, and `TBJ_KEY_PASSWORD`.
- [ ] **Step 5: Create the keystore once (shared by both flavors).**
  - Run `keytool -genkeypair -keystore "…/tbj-signing/tbj-release.jks" -alias tbj -keyalg RSA -keysize 4096 -validity 10000`, with a random password written to `keystore.properties`.
  - Record the SHA-256 fingerprint in `mobile/README.md`.
  - JDK 21 is required and only 19 is installed: use Temurin 21 or Android Studio's JBR.
- [ ] **Step 6: Build and verify the Admin app.**
  - Run `./gradlew assembleAdminRelease`. Expect a signed `app-admin-release.apk`; confirm with `apksigner verify --print-certs`.
  - On an emulator or phone: the app opens at `/admin` (which redirects to `/login`), login and TOTP work, an admin action saves, an external link opens the system browser, and the back button and offline screen behave.
- [ ] **Step 7: Then build and verify the Client app.**
  - Add the client strings ("TBJ Growth Tech"), its icon, and the manifest permission removal.
  - Run `./gradlew assembleClientRelease`.
  - Verify:
    - The app opens `/`, `/bn-bd` works, and `/ar-ae` renders RTL.
    - The booking form works and there is no notification permission prompt.
    - `aapt dump permissions` shows no `POST_NOTIFICATIONS`.
    - Both apps install side by side.
- [ ] **Step 8:** Write `mobile/README.md`, covering building each flavor, version bumping, keystore backup, and the Cloudflare note: set Build watch paths to exclude `mobile/**` and `docs/**` (a dashboard setting the user applies).
- [ ] **Step 9: Commit:** `feat(mobile): Capacitor admin + client flavors with native push, biometric lock, back button, offline screen`

### Task 6: Admin mobile pass (leads, bookings, posts/approvals, dashboard) at 360px

**Files (expected; confirm with an audit first):**
- Modify: `components/Admin/AdminSidebar.tsx`, `app/admin.css`, `app/(admin)/admin/leads/**`, `app/(admin)/admin/booking/**`, `app/(admin)/admin/posts/**`, `components/Admin/Posts/**`, `components/Admin/LeadReplyBox.tsx`, `components/Admin/Editor.tsx` (toolbar wrap), `app/(admin)/admin/page.tsx`

**Acceptance criteria (spec §7.2).** At 360×740 (Chrome device mode and a real phone in the app), every task in these four areas works with no horizontal page scroll:
- Leads: open the list, read a lead, mark it read, reply.
- Bookings: view bookings, cancel one, add slots.
- Posts: create, edit in Tiptap, submit for review, approve or request changes, publish.
- Dashboard: the page reads cleanly.

Requirements:
- Tables become stacked cards below `md`, or keep a contained `overflow-x-auto` with a visible first column.
- Tap targets are at least 44px.
- The sidebar is a drawer that closes on navigation.
- Respect the safe area (`env(safe-area-inset-*)`, with `viewport-fit=cover` in the root viewport).
- Inputs are at least 16px font so iOS doesn't zoom.

- [ ] **Step 1: Audit.** Screenshot each area at 360px with claude-in-chrome against `next dev`, and list the defects per page.
- [ ] **Step 2:** Fix the defects in that order. Keep each change inside existing Tailwind tokens (see the memory note on theme changes needing a usage audit).
- [ ] **Step 3: Verify.** Re-screenshot every flow at 360px and at 1280px (desktop must not regress). `npm run build` and `npm run lint` pass.
- [ ] **Step 4:** Check RTL: `/ar-ae` public pages in the app at 360px.
- [ ] **Step 5: Commit:** `feat(admin): mobile layout for leads, bookings, posts and dashboard`

### Task 7: Download pages (public `/app` for client, `/admin/app` for admin) + privacy policy draft

**Files:**
- Create: `app/(public)/[locale]/app/page.tsx` (route `/app`), `app/(public)/[locale]/privacy-policy/page.tsx`, `lib/mobile-app.ts`, `app/(admin)/admin/app/page.tsx` (route `/admin/app`), `app/api/admin/app-download/route.ts`
- Modify:
  - `components/HomeComponents/Footer.tsx`: in Resources, add "Get the App" → `/app` and "Privacy Policy" → `/privacy-policy`.
  - Static sitemap: add both public pages. Never add `/admin/app`.
  - Admin sidebar in `app/(admin)/layout.tsx`: add "Get the Admin App" for all roles.
  - `wrangler.jsonc`: add `{ "binding": "APP_BUILDS", "bucket_name": "tbj-app-builds" }` to `r2_buckets`. The bucket must exist before deploying.
  - `.env.example` / `docs/environment-variables.md`: add `NEXT_PUBLIC_ANDROID_APK_URL` and `NEXT_PUBLIC_ANDROID_APP_VERSION`.
- Test: `tests/mobile-app-config.test.ts`, `tests/admin-app-download.test.ts`

**Interfaces:**
- Produces:
  - `getClientApk(): { url: string; version: string | null }`. It uses the env var if it is `https:`, else `https://downloads.tbjgrowthtech.com/tbj-growth-tech.apk`.
  - `ADMIN_APK_KEY = "tbj-admin.apk"`.
  - `GET /api/admin/app-download`:
    1. Calls `requireSession()` from `lib/auth-guard`, which includes the revoke check. `/api` is outside middleware, so the route must check this itself.
    2. Returns 401 JSON if the caller isn't authenticated.
    3. Reads `APP_BUILDS.get(ADMIN_APK_KEY)` through `getCloudflareContext()`, and returns 404 if the object is missing.
    4. Streams the file with these headers:
       - `Content-Type: application/vnd.android.package-archive`
       - `Content-Disposition: attachment; filename="tbj-admin-<version>.apk"`, where the version comes from the object's `customMetadata.version` (default `latest`)
       - `Cache-Control: private, no-store`
    5. Writes the download to the audit log.

**Public `/app` page** (client app only; no mention of the admin app or staff login):
- A "Download for Android" button and the version.
- Install steps:
  1. Tap Download and open the file.
  2. If Android blocks it, tap **Settings** → enable **Allow from this source** for Chrome → go back → **Install**.
  3. Open TBJ Growth Tech.
- Note: "site updates appear automatically".
- iPhone: Safari → **Share** → **Add to Home Screen** → **Add**.
- User-agent detection orders the sections. Both are rendered server-side.

**`/admin/app` page:**
- A "Download TBJ Admin" button that links to `/api/admin/app-download`.
- The same unknown-sources steps.
- After installing: "sign in, allow notifications, set alerts in Profile → Notifications".
- iPhone note: use the PWA; push isn't available there yet.
- Shows the current version from the R2 object metadata, or "not uploaded yet".

**Privacy policy draft:** same as before. Verify the processors against `docs/integration-setup.md`, keep the draft comment, and flag it in the handoff.

- [ ] **Step 1: Write failing tests:**
  - `getClientApk`: uses the default, and rejects a non-https value.
  - Download route:
    - `401 without session`
    - `401 for revoked session`
    - `404 when object missing`
    - `200 streams with apk content-type, attachment disposition, no-store`
- [ ] **Step 2:** Run `npm test`. Expected: FAIL. Implement, then run again. Expected: PASS. `npm run check:actions` passes.
- [ ] **Step 3:** Build the pages, the footer links, and the sidebar entry.
- [ ] **Step 4: Verify.**
  - Check `/app`, `/bn-bd/app`, `/ar-ae/app`, `/privacy-policy`, and `/admin/app` at 360px and desktop.
  - `/api/admin/app-download` returns 401 when logged out.
  - `npm run build` passes.
- [ ] **Step 5: Commit:** `feat(site): client app download page, admin app download via private R2, privacy policy draft`

### Task 8: Firebase + R2 handoff (user-run, documented)

**Files:** Modify `mobile/README.md`, `docs/deployment.md`.

- [ ] **Step 1: Document Firebase.**
  1. Create one project with **two Android apps**, `com.tbjgrowthtech.admin` and `com.tbjgrowthtech.app`, both registered with the SHA-256 from Task 5.
  2. Download the combined `google-services.json` (it holds both apps) to `mobile/android/app/`. It is gitignored.
  3. In Service accounts, generate a key and store it with `wrangler secret put FCM_SERVICE_ACCOUNT_JSON`. Also put it in `.env.local`.
  4. Rebuild both flavors.
- [ ] **Step 2: Document R2 (two files).**
  - **Admin APK, private bucket `tbj-app-builds`:** no public access, and create it **before** deploying the wrangler change. Upload with `wrangler r2 object put tbj-app-builds/tbj-admin.apk --file app-admin-release.apk --content-type application/vnd.android.package-archive --custom-metadata version=1.0.0`.
  - **Client APK, public bucket `tbj-downloads`:** served on `downloads.tbjgrowthtech.com`. Upload `tbj-growth-tech.apk` and bump `NEXT_PUBLIC_ANDROID_APP_VERSION`.
- [ ] **Step 3: End-to-end on a real phone.**
  - **Admin app:**
    1. Log in and download from `/admin/app`, then install and log in.
    2. Submit the contact form from another device: a notification arrives with no personal data, and tapping it opens `/admin/leads`.
    3. Log out and submit again: no notification arrives.
  - **Client app:** download from `/app` and install it alongside the admin app. Browsing and booking a call work, and there is no notification prompt.
- [ ] **Step 4: Commit:** `docs(mobile): Firebase (two apps), signing and R2 release runbook`
