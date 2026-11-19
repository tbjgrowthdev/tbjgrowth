# TBJ Android apps (Capacitor)

One Capacitor project, two Android apps (product flavors), one signing key:

| Flavor | Package ID | Name | Opens | Native features | Distributed from |
|---|---|---|---|---|---|
| `admin` | `com.tbjgrowthtech.admin` | TBJ Admin | `https://tbjgrowthtech.com/admin` | push notifications, biometric lock, back button, offline screen | `/admin/app` (signed-in only, private R2) |
| `client` | `com.tbjgrowthtech.app` | TBJ Growth Tech | `https://tbjgrowthtech.com/` | back button, offline screen | `/app` (public R2) |

**Package IDs and the signing key are permanent.** Google Play only accepts
updates signed with the same key under the same ID, so never change either.

Both apps load the **live site** (`server.url`); they don't bundle it. A
website deploy updates both apps immediately. You only build a new APK when
something in `mobile/` changes (plugins, icons, config) or to bump the version.

The website talks to the native plugins through `window.Capacitor`
(`lib/native.ts`, `components/Admin/NativeAppBridge.tsx`). The bridge only
runs in TBJ Admin (`isAdminApp()`), so the client app never asks for
notification permission even if someone opens `/admin` in it.

## One-time setup on a build machine

- **JDK 21** (Capacitor 8 needs it). This machine uses a portable Temurin at
  `TBJ-works/tools/jdk-21.0.13+9`: set `JAVA_HOME` to it before building.
  Android Studio's bundled JBR also works.
- **Android SDK** with platform 36 and build-tools 35+. Gradle downloads
  missing platforms itself. `android/local.properties` (gitignored) holds
  `sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk` (forward slashes).
- `cd mobile && pnpm install --ignore-workspace`

## Signing key (back it up)

- Keystore: `TBJ-works/tbj-signing/tbj-release.jks` (alias `tbj`, PKCS12, RSA 4096, valid to 2054).
- Passwords: `TBJ-works/tbj-signing/keystore.properties`. `android/app/build.gradle` reads it automatically.
  Alternatively set `TBJ_KEYSTORE_PATH`, `TBJ_KEYSTORE_PASSWORD`, `TBJ_KEY_ALIAS`, `TBJ_KEY_PASSWORD`.
- Both files are **outside the repo** and gitignored (`*.jks`, `keystore.properties`).
- **Back up both files now** to two places (e.g. a password manager plus offline storage).
  If the key is lost, no existing install can ever be updated and Play needs a new app.
- Certificate fingerprints (needed for Firebase and Play):
  - SHA-1: `4F:C6:1F:FD:DE:21:0B:A1:13:67:7C:11:AE:7E:DA:AE:A7:A8:12:F7`
  - SHA-256: `10:3B:80:DB:C0:64:E9:EA:33:30:F5:4B:5A:DD:DF:92:0F:12:86:32:32:36:60:BC:22:BB:87:3B:61:73:DE:69`

## Build

```bash
cd mobile
npm run sync                 # cap sync + per-flavor capacitor.config.json (scripts/flavor-configs.mjs)
cd android
./gradlew assembleAdminRelease    # -> app/build/outputs/apk/admin/release/app-admin-release.apk
./gradlew assembleClientRelease   # -> app/build/outputs/apk/client/release/app-client-release.apk
```

Build the Admin app first; the client app after.

Check a build:

```bash
apksigner verify --print-certs <apk>       # SHA-256 must match the one above
aapt dump badging <apk> | grep -E "package|label|permission"
```

The client APK must not list `POST_NOTIFICATIONS` or `USE_BIOMETRIC`
(they're stripped in `android/app/src/client/AndroidManifest.xml`).

## Releasing a new version

1. In `android/app/build.gradle`, bump `versionCode` (+1, integer) and `versionName` (e.g. `1.0.1`).
2. Build both flavors (above).
3. Upload to R2 (see "Hosting the APKs") and update the version shown on the download pages.

## Icons and splash

`node scripts/generate-app-icons.mjs` (from the repo root) generates
`public/icons/*`, `mobile/assets/<flavor>/icon-only.png` (1024px, for store
listings), and every launcher icon and splash screen under
`android/app/src/<flavor>/res`. Admin = dark icon, client = light icon.

## Push notifications (Firebase)

See "Firebase setup" in `docs/deployment.md`. Until `android/app/google-services.json`
exists, the apps build without Firebase and push simply doesn't register.

## Hosting the APKs

See "Android app releases" in `docs/deployment.md`. In short:
- Admin APK goes to the **private** R2 bucket `tbj-app-builds`. The site serves it only to signed-in admins at `/api/admin/app-download`.
- Client APK goes to the **public** R2 bucket `tbj-downloads` on `downloads.tbjgrowthtech.com`, linked from `/app`.

APKs are never committed (`*.apk` is gitignored).

## Cloudflare: don't redeploy the site for app-only changes

In Cloudflare → Workers & Pages → `tbjgrowth` → Settings → Builds, set
**Build watch paths** to exclude `mobile/**` and `docs/**`. Then commits
that only touch the Android project don't trigger a website deploy.

## Things to test on a real phone (each release)

- **TBJ Admin:**
  - Opens at `/admin` and redirects to `/login`. Login and 2FA work, and you stay signed in after closing the app.
  - It asks for notification permission.
  - Saving something in admin works.
  - Back button: goes back through pages, and leaves the app from the first page.
  - Airplane mode shows the offline screen.
  - A WhatsApp or Google link opens in the browser.
  - After 5+ minutes in the background, the fingerprint or PIN lock appears.
- **TBJ Growth Tech:**
  - Opens the home page; `/bn-bd` works and `/ar-ae` shows right-to-left.
  - Booking a call works.
  - It never asks for notification permission.
- Both apps install side by side.
