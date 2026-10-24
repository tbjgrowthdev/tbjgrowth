# Integration setup

Two separate systems live under this heading, and the admin UI keeps them
on separate pages for that reason:

- **Integration Hub** (`/admin/integrations`, `lib/integrations/`) — stores
  and tests credentials for outbound third-party connections.
- **Automation Engine** (`/admin/automation`, `lib/automation/`) — rule-based
  "when X happens, do Y" workflows that *use* some of those integrations
  (Slack, Webhooks) as one of several possible actions.

## Integration Hub

### Providers

`lib/integrations/registry.ts` is the single source of truth for what the
Hub supports. Six providers, each with its own credential fields and
(usually) a live connection test:

| Provider | Category | Credentials | Live test? |
| --- | --- | --- | --- |
| `GOOGLE_BUSINESS_PROFILE` | Local SEO | Access token (manually generated, not a full OAuth consent flow yet) | Yes — `providers/google-business-profile.ts` |
| `META` | Advertising | Graph API access token | Yes — `providers/meta.ts` |
| `CRM` | Sales | API key + optional base URL | **No** — no vendor is named, so there's no API to call. Saving marks it Connected without an independent check; the admin UI says so rather than faking a verified result. |
| `SLACK` | Notifications | Bot token (`xoxb-...`) + default channel | Yes — `providers/slack.ts` |
| `WORDPRESS` | CMS | Site URL + username + Application Password | Yes — `providers/wordpress.ts` |
| `WEBHOOKS` | Automation | Endpoint URL + optional HMAC signing secret | Yes — `providers/webhooks.ts` |

Deliberately **not** in this registry (see the `Integration` model's schema
comment and `registry.ts`'s own comment): Google Search Console/Analytics,
the AI providers (Anthropic/OpenAI/Gemini), and Resend email. Those are
configured via plain env vars, not the Hub, but `lib/integrations/mirror.ts`
surfaces their *status* alongside the Hub-owned ones on the same page —
`listIntegrationStatuses()` in `lib/integrations/manage.ts` merges
`getGoogleMirrorStatuses()` / `getAiProviderMirrorStatus()` /
`getEmailMirrorStatus()` with the Hub's own rows, so `/admin/integrations`
and the Observability "failed integrations" tile both read one connected
category list, not two.

### Credential storage

Credentials are stored encrypted in the `Integration` table, not in
plaintext and not in env vars. `lib/integrations/crypto.ts`:

- AES-256-GCM, via Node's `crypto` module.
- Key comes from `INTEGRATION_ENCRYPTION_KEY` — a base64-encoded 32-byte
  key, generated with `openssl rand -base64 32` (see `.env.example`). Read
  fresh from `process.env` on every call, not cached at module load, so a
  key rotation takes effect without needing a restart first.
- Stored format: `"<iv>:<authTag>:<ciphertext>"`, each base64. Decryption
  verifies the GCM auth tag and throws on a wrong key or tampered
  ciphertext, rather than silently returning garbage.

### Setup flow (connecting a provider as an admin)

1. `/admin/integrations` lists every provider from the registry, each
   showing its current status: `DISCONNECTED`, `CONNECTED`, or `ERROR`
   (`lib/integrations/manage.ts`'s `listIntegrationStatuses`).
2. Opening a disconnected provider renders its `fields` from the registry
   definition (password/text/url inputs as declared).
3. Submitting calls `saveIntegrationCredentials` (`manage.ts`): if the
   provider has a `testConnection`, it runs **first** — credentials are
   stored either way (a failed test might just be a transient network
   issue), but the stored `status`/`lastError` reflect the real test
   result rather than "saved, assumed fine." Providers with no
   `testConnection` (currently only `CRM`) are marked `CONNECTED` on save
   with no independent verification.
4. Disconnecting removes the row; the provider reverts to `DISCONNECTED`.

## Automation Engine

### Model

`AutomationRule` → (when it fires) → `AutomationRun` → `AutomationStepRun`
(one row per step, in order). A rule has one `event` it listens for, a set
of `conditions` (JSON, matched by `lib/automation/conditions.ts`), and an
ordered list of `actions` (JSON `ActionStep[]`, each optionally
`requiresApproval`).

**Events** (`AutomationEvent` enum, `prisma/schema.prisma`):
`CONTENT_PUBLISHED`, `RANKING_DECLINE`, `CTR_DECLINE`, `TRAFFIC_DECLINE`,
`CONVERSION_DECLINE`, `CONTENT_DECAY`, `CANNIBALIZATION`.

**Actions** (`AutomationActionType` enum):
`GENERATE_SCHEMA`, `UPDATE_SITEMAP`, `RUN_SEO_AUDIT`,
`GENERATE_SOCIAL_DRAFT`, `NOTIFY_TEAM`, `CREATE_PERFORMANCE_ANALYSIS`,
`CREATE_REFRESH_DRAFT`, `ASSIGN_REVIEWER` — implemented in
`lib/automation/actions.ts`. `NOTIFY_TEAM` is itself multi-channel
(Slack / webhook / email, per its `config.channel`) — Observability's
"failed webhooks" tile specifically filters `NOTIFY_TEAM` steps whose
channel is `"webhook"`, since the same action type also covers Slack and
email failures that belong to different dashboards.

### Who fires an event

`fireAutomationEvent()` in `lib/automation/engine.ts` is the only entry
point. It's called from:
- `lib/workflow.ts`'s `transitionContent` — fires `CONTENT_PUBLISHED`.
- `lib/seo-performance-feedback/scan.ts` — fires the other six
  performance-decline events.

It deliberately swallows every error: a misbehaving automation rule must
never break the publish flow or scan it's attached to.

### Run lifecycle

`AutomationRunStatus`: `RUNNING` → `SUCCEEDED` / `FAILED`, or
`AWAITING_APPROVAL` → (admin approves) → back to `RUNNING`, or →
`REJECTED`. `startRun()` creates the run plus all its step rows in one
nested `prisma.automationRun.create({ data: { steps: { create: [...] } } })`
call, then `advanceRun()` executes `PENDING` steps in order, stopping at
the first step that `requiresApproval`, fails, or (once all succeed)
completing the run. `approveStep`/`rejectStep` (admin-only, `APPROVE`
permission) are how a paused run resumes or stops.

`/admin/automation` lets an admin create/edit rules, and "Run Now" a rule
against a specific piece of content (`runRuleManually`) — this bypasses
the rule's conditions entirely, since picking a rule *and* a content item
by hand is already an intentional choice.

### ⚠️ Open question for whoever writes known-limitations.md

No live `$transaction()`, `createMany()`, or `updateMany()` call exists
anywhere in `lib/automation/` — I checked. But `startRun()` in
`lib/automation/engine.ts` does this:

```ts
const run = await prisma.automationRun.create({
  data: {
    ...,
    steps: { create: steps.map((step, index) => ({ ...})) },
  },
});
```

That's a **nested write across two tables** (`AutomationRun` +
`AutomationStepRun`) in a single `create()` call. This repo's
Neon-HTTP-adapter transaction bug (see `lib/prisma.ts`) was found to break
`createMany`/`updateMany` even as a *single* top-level call, because
Prisma routes them through the same `startTransaction()` path internally.
A nested create spanning multiple tables is exactly the kind of call
Prisma's query engine is also known to wrap in an implicit transaction —
**this was not tested live this round**, so I can't confirm whether it
actually fails the same way. If it does, every automation rule's first
`create` would be failing in production right now. Whoever owns
known-limitations.md (or anyone touching `lib/automation/engine.ts` next)
should run the same live-debug-route test used elsewhere this session
against `startRun()` before assuming it's fine.
