# Admin/API security

## Admin authentication (2FA, sessions, login history)

- **2FA**: TOTP, via `lib/totp.ts` (`otpauth` — pure JS, only depends on
  `@noble/hashes`, no native/WASM — plus `qrcode` for the setup QR, also
  pure JS). Enable/disable/regenerate backup codes from **Admin → My
  Profile**. A pending secret is stored as soon as setup starts but
  `twoFactorEnabled` only flips to `true` once the user proves they can
  generate a code with it — an abandoned setup never silently turns 2FA on.
  10 single-use backup codes (bcrypt-hashed, shown once) cover lost-device
  recovery. The login page (`app/login/page.tsx`) does this as a second
  `signIn()` call from the same form once `lib/auth.ts`'s `authorize()`
  returns the `"2FA_REQUIRED"` sentinel — Credentials provider can't do a
  true multi-step server flow, so this is the two-call pattern that works
  within that constraint.
- **Session management / device list**: NextAuth v4 can't use its
  "database" session strategy with `CredentialsProvider`, so this app stays
  JWT-based but adds its own `AdminSession` table (not the unused
  `Session`/`Account` models — see their schema comments for why those stay
  reserved for a future SSO provider's adapter). Every sign-in creates a row
  (ip, user-agent, timestamps); the JWT carries that row's id as
  `sessionId`; `lib/auth-guard.ts`'s `requireSession()` — already called by
  every server action — checks `revokedAt` on it on every request. That's
  what makes "Revoke" in **Admin → My Profile → Active Sessions** actually
  take effect immediately, without switching session strategy.
- **Login history**: `LoginAttempt` (email, success, ip, timestamp) was
  already being written on every attempt but had no UI reading it back.
  Now visible per-account in **My Profile**, and across every account in
  **Admin → Monitoring → Logins** (gated on `USER_MANAGEMENT`, same tier as
  Leads/Audit Log).
- **Failed login monitoring**: the lockout below, plus an email to the
  affected account the moment it crosses the lockout threshold (not on
  every attempt after — see `notifyIfJustLockedOut` in `lib/auth.ts`), plus
  the admin-wide Monitoring → Logins view for someone watching for patterns
  across accounts.

## Future SSO readiness

Not implemented now (none was asked for), but the pieces are already in
place so adding one later is additive, not a redesign:
- `User.password` is already nullable — an SSO-only account needs no local
  password.
- `Account`/`Session`/`VerificationToken` models already exist in the
  schema (NextAuth's standard adapter shape) but are unused while this app
  is Credentials+JWT-only — wiring in `@auth/prisma-adapter` and a new
  provider (Google Workspace OIDC, Okta, Azure AD, SAML via an OIDC bridge)
  is the expected next step, not a migration.
- `lib/session-tracking.ts`'s `createAdminSession`/`isSessionRevoked` are
  provider-agnostic by design — a new provider just needs to call
  `createAdminSession` from wherever it captures ip/user-agent (NextAuth
  v4's `jwt`/`events.signIn` callbacks don't receive the raw request, so
  that capture is necessarily provider-specific, same as it is today inside
  Credentials' `authorize()`).
- Role assignment for a first-time SSO login isn't decided yet (e.g.
  domain-allowlist + default role, vs. an admin pre-provisioning the user
  row) — flag this as a real decision when SSO is actually scoped, not
  something this pass guessed at.


Status of each item, what's implemented in this repo vs. what belongs in the
Cloudflare dashboard, and why.

## Secret management

- **Rule: no secret ever goes in `wrangler.jsonc` or any other committed
  file.** This repo already hit this exact mistake once (a local commit put
  every production secret into `wrangler.jsonc`'s `vars` block in plaintext;
  it was caught by GitHub's push protection before reaching the remote, and
  the commits were rewritten out of history — but treat it as a live
  reminder, not a closed incident).
- Local dev: copy `.env.example` to `.env` and fill in real values there —
  `.env*` is gitignored.
- Deployed Worker: every secret lives in **Cloudflare dashboard → Workers &
  Pages → the Worker → Settings → Variables and Secrets** (runtime bindings,
  populated into `process.env` by OpenNext's `populateProcessEnv`), never in
  this repo, never in Cloudflare's "Build variables" (those are
  build-time-only and invisible at runtime — see the `NEXTAUTH_SECRET`
  incident earlier in this project's history for what that distinction
  actually breaks).
- GitHub Actions secrets (a separate store, for the backup/uptime workflows
  in `.github/workflows/`) are documented in
  `docs/runbooks/database-restore.md`.
- **Outstanding**: the secrets that were briefly in that `wrangler.jsonc`
  commit were also pasted in plaintext into a chat transcript. Rotating them
  is still recommended whenever convenient: Neon DB password, `NEXTAUTH_SECRET`,
  Google OAuth client secret, Resend API key, `CRON_SECRET`, Cloudinary API
  secret, DataForSEO password.

## /admin protection

Already solid, no change needed beyond what's below:
- `middleware.ts` gates every `/admin/*` route on a valid NextAuth session +
  role, before the page even renders.
- Every mutating Server Action additionally calls `requirePermission(...)`
  (`lib/auth-guard.ts`) — defense in depth, since a Server Action is invoked
  directly by ID and isn't re-checked by middleware's route matching.
- The whole admin tree sets `robots: { index: false, follow: false }`.

## /api protection

- `/api/cron/*` (scheduled jobs, link check, backup/uptime reporting):
  bearer-token protected via `CRON_SECRET`, checked independently of any
  session — see those routes' own comments.
- `/api/internal/redirects`: intentionally public — it's the public
  redirect map, not sensitive, and middleware (Edge runtime, no direct DB
  driver) calls it internally.
- `/api/internal/client-error`: intentionally unauthenticated (a crashed
  client can't carry a session), abuse-bounded by `lib/error-monitor.ts`'s
  own alert dedup.
- `/api/internal/env-check` (temporary diagnostic route from an earlier
  incident, unauthenticated, reported which secrets existed): **deleted** —
  its own comment said to remove it once resolved, and an unauthenticated
  "which secrets are configured" endpoint is exactly the kind of thing this
  pass is closing.
- `/api/auth/*`: NextAuth's own routes — CSRF-protected by NextAuth itself
  (double-submit token).

## Brute-force protection

- `lib/auth.ts` now enforces a lockout: 5 failed attempts for the same email
  within 15 minutes blocks further attempts for that email (`LOCKOUT_MAX_ATTEMPTS`
  / `LOCKOUT_WINDOW_MS`), built on the `LoginAttempt` table that was already
  being written on every attempt but never read back. Keyed by email, not
  IP — Cloudflare's edge means the IP this app sees is often shared/rotating,
  while the attacked account is the fixed, meaningful key. Fails open (allows
  the attempt) if the lockout check itself errors, so a DB hiccup never locks
  everyone out.
- `LoginAttempt.ip` is now populated (from `cf-connecting-ip`, falling back
  to `x-forwarded-for` for local dev) for forensics, though lockout itself
  doesn't key on it.
- This is app-level and account-specific. It is not a substitute for the
  network-level rate limiting below, which is what actually stops a
  distributed/volumetric credential-stuffing attempt before it reaches the
  app at all.

## API rate limiting / WAF compatibility

Deliberately **not** implemented as an in-app limiter. Reasoning:
- This app runs on Cloudflare Workers specifically because Cloudflare sits
  in front of every request already — rate limiting belongs at that layer,
  not re-implemented in the Worker. An in-app limiter would also need a
  durable cross-isolate counter (KV or the Rate Limiting binding), which is
  more infra to provision and another moving part in a deployment that has
  already broken twice this project on new runtime dependencies.
- Recommended setup (Cloudflare dashboard → Security → WAF → Rate limiting
  rules, on the zone in front of this Worker):
  - `/login` and `/api/auth/*`: e.g. 10 requests / 1 minute per IP, action
    "Block" or "Managed Challenge".
  - `/api/*` generally: e.g. 60 requests / 1 minute per IP.
  - `/admin/*`: e.g. 100 requests / 1 minute per IP (higher — legitimate
    admin usage is bursty: saving content, loading the media library).
- WAF managed rules (Cloudflare dashboard → Security → WAF → Managed rules):
  turn on Cloudflare's Managed Ruleset and the OWASP Core Ruleset. Nothing in
  this app needs an exception from them — no endpoint relies on sending
  raw SQL, script tags, or shell metacharacters through as normal traffic.
- The two app-level throttles that *do* exist (`submitContactForm` in
  `app/(admin)/actions/forms.ts`, `createBooking` in
  `app/(admin)/actions/booking.ts` — both cap submissions per email in a
  rolling window using existing table timestamps, no new infra) are a
  second layer against scripted spam specifically, not a replacement for
  the above.

## CSRF

Already covered by the framework, no code added:
- Every state-changing admin/public operation goes through a Next.js Server
  Action (`"use server"`), which has built-in same-origin (Origin header)
  CSRF protection by default. `next.config.ts` doesn't set
  `experimental.serverActions.allowedOrigins`, so this stays at its
  strictest (same-origin only).
- NextAuth's own endpoints use its built-in CSRF token.
- No route handler in this app does a cookie-authenticated state change
  outside of a Server Action, so there's no gap needing a manual token.

## XSS

- **Found and fixed**: `Post.content`, `Page.content`, `CaseStudy.content`,
  and `AgencyService.content` are rich text from the Tiptap editor, rendered
  on the public site via `dangerouslySetInnerHTML` with no sanitization —
  the one real stored-XSS vector in this app (a compromised or malicious
  admin account could have injected `<script>`/event-handler HTML that would
  run in every visitor's browser).
- Fixed with `lib/sanitize.ts` (`sanitize-html`, pure JS, no native/WASM
  deps — safe in both local `next dev` and the Cloudflare Worker), applied
  twice: once when content is saved (`app/(admin)/actions/posts.ts`,
  `pages.ts`, `cases.ts`, `services.ts`) and again where it's rendered
  (the four public detail pages) as defense in depth against anything
  stored before this fix existed.
- JSON-LD `dangerouslySetInnerHTML` blocks (`components/JsonLd.tsx`,
  `SchemaRenderer.tsx`, and the inline `<script type="application/ld+json">`
  tags) are unaffected — those serialize our own server-built objects via
  `JSON.stringify`, never raw user/admin HTML, and `application/ld+json` is
  non-executable regardless.

## SQL injection

Already protected, no change needed: every DB access goes through Prisma's
parameterized query builder. `$queryRaw`/`$executeRaw` only appear in the
generated client's own type definitions/doc comments — grepped the whole
app for actual usage and found none.

## Secure headers / CSP

Added in `next.config.ts`'s `headers()` (applies to every route, including
`/api/*`, since this runs at the Next.js routing layer rather than through
`middleware.ts`, which deliberately excludes `/api/*`):
- `Content-Security-Policy` — `default-src 'self'`, with `script-src`/
  `style-src` allowing `'unsafe-inline'` (Next's own hydration bootstrap and
  framer-motion's inline style attributes need it; there's no nonce
  plumbing through `middleware.ts`, which is already doing a lot in the one
  Edge function Cloudflare allows here). The directives that actually stop
  the attacks in scope — `connect-src 'self'` (data exfiltration),
  `frame-ancestors 'none'` (clickjacking), `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'` — don't depend on script-src being
  strict.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`,
  `Strict-Transport-Security` (2 years, includeSubDomains, preload — safe
  since the site is Cloudflare/HTTPS-only).
- If a future change needs inline `<style>`/`<script>` tightened further,
  moving to a nonce requires generating the nonce in `middleware.ts` and
  reading it in `app/layout.tsx` — not done here to avoid adding more to
  that file right now; tracked as a known follow-up, not an oversight.

## Verification done

- `npx tsc --noEmit` and `npx eslint` clean on every changed/new file.
- Manual trace of every `dangerouslySetInnerHTML` and `$queryRaw`/
  `$executeRaw` call site in the app (listed above).
- Not yet done: a live check that the CSP doesn't break anything in a real
  browser (Tiptap's toolbar, framer-motion animations, Cloudinary images) —
  do this after deploying, watching the browser console for CSP violation
  warnings before assuming it's clean.
