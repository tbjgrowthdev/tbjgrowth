# Permission Matrix

Source of truth: `lib/permissions.ts`'s `ROLE_PERMISSIONS` map. This is a
**fixed matrix, not a computed hierarchy** — each role's permission list is
written out explicitly (see that file's own comments for the reasoning behind
each cut), so don't assume "higher role ⊃ lower role's permissions" holds for
every pair; check the table below instead. (In practice it does hold here —
`SUPER_ADMIN` ⊇ `ADMIN` ⊇ `EDITOR`-minus-SEO-tools, etc. — but that's because
it was built that way, not because the code enforces it structurally.)

## The 13 permissions × 5 roles

| Permission | SUPER_ADMIN | ADMIN | EDITOR | SEO_MANAGER | CONTRIBUTOR |
|---|---|---|---|---|---|
| `VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `CREATE` | ✅ | ✅ | ✅ | ❌ | ✅ |
| `EDIT` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DELETE` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `PUBLISH` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `APPROVE` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `SCHEDULE` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `MEDIA_MANAGEMENT` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `SEO_MANAGEMENT` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `USER_MANAGEMENT` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `SETTINGS_MANAGEMENT` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `INTEGRATION_MANAGEMENT` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `EXPORT` | ✅ | ✅ | ❌ | ✅ | ❌ |

Checked with `hasPermission(role, permission)`, called by every
`requirePermission(permission)` in `app/(admin)/actions/*.ts` (full call-site
list in `docs/api.md`). A role not in `ROLE_PERMISSIONS` (shouldn't happen —
`Role` is a closed Prisma enum) is treated as having no permissions at all,
not an error.

## Where each permission is actually spent

Not every permission maps 1:1 to one feature — a few notable groupings, from
the real `requirePermission(...)` call sites:

- **`USER_MANAGEMENT`** gates more than user CRUD: it also gates
  `app/(admin)/actions/forms.ts`'s lead inbox (`getLeads`/`markLeadAsRead`),
  `audit.ts`'s audit log, and `security.ts`'s cross-account login history
  (`getAllLoginHistory`) — these were grouped in with user management rather
  than given their own permission.
- **`SEO_MANAGEMENT`** is the single biggest permission by surface area:
  keyword tracking, redirects, link graph, topic clusters, link monitor,
  orphan pages, content health/recommendations/cannibalization scans, SEO
  audits, SEO experiments, SEO change log, canonical/hreflang, GSC/GA4
  import, programmatic SEO, and Local SEO locations/FAQs all gate on it (a
  few of those — `locations.ts`, `locationFaqs.ts`, `serviceFaqs.ts` — gate on
  the narrower `CREATE`/`EDIT`/`DELETE` instead; see `docs/api.md` for which).
- **`SETTINGS_MANAGEMENT`** covers site settings, the Monitoring dashboard,
  and Technical SEO checks (web vitals summary, failed-login report, TLS
  certificate check) — these read operational/diagnostic data, not just
  settings, but were grouped with settings rather than `USER_MANAGEMENT` or a
  dedicated ops permission.
- **`EXPORT`** gates `import-export.ts`'s `export*` actions and the page
  itself — `SEO_MANAGER` holds it (useful for exporting SEO data), but
  `EDITOR` does not. The `import*` actions need `CREATE` **and** `DELETE`
  instead (`requireImport()`), because an import creates and overwrites
  records in bulk. Since the page needs `EXPORT` too, in practice only
  Super Admins and Admins can import; SEO Managers see export only.
- **`CREATE`/`EDIT`/`DELETE`** also gate most non-CMS-workflow content
  (FAQs, testimonials, partners, systems, pricing, booking slots) — these
  reuse the content permissions rather than getting their own, since they're
  simple CRUD with no approval workflow.
- **Workflow transitions** (`transitionPost`/`transitionPage`/
  `transitionCaseStudy`, routed through `lib/workflow.ts`) don't check one
  fixed permission — which permission is required depends on *which*
  transition is being attempted (submit for review vs. approve vs. publish
  vs. schedule). See `docs/cms-workflow.md` for the per-transition table.

## Every Server Action checks auth itself

Server Actions can be called directly by id, so every export in a
`"use server"` file runs its own check, even when the lib function it calls
already checks the same permission (defense in depth). Thin wrappers use
`guardMutation(permission, fn)` / `guardRead(permission, fallback, fn)` from
`lib/action-guard.ts`; on denial they return `{ success: false, error }` or
the reader's usual empty value. `"SESSION"` means any signed-in admin.

`npm run check:actions` (`scripts/check-server-action-auth.mjs`, run in CI
by `.github/workflows/checks.yml`) fails if any export never calls
`requireSession`/`requirePermission`/`guardMutation`/`guardRead`, directly or
through a local helper. Actions the public site uses (booking, contact form,
published content readers, 404 logging) are marked
`// auth-check: public — <reason>` directly above the function.

## User management: who can manage whom

This is a second, separate check (`canManageUserWithRole`, in
`lib/permissions.ts`) layered *underneath* `USER_MANAGEMENT` — holding the
permission is necessary but not sufficient:

| Acting role ↓ / Target role → | SUPER_ADMIN | ADMIN | EDITOR | SEO_MANAGER | CONTRIBUTOR |
|---|---|---|---|---|---|
| **SUPER_ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ADMIN** | ❌ | ❌ | ✅ | ✅ | ✅ |
| (EDITOR / SEO_MANAGER / CONTRIBUTOR) | — | — | — | — | — (no `USER_MANAGEMENT`, never reach this check) |

Full detail and the login/role-assignment flow: `docs/admin-roles.md`.

## What `INTEGRATION_MANAGEMENT` gates

Super Admin only. Covers: Integration Hub connect/edit/reconnect/disconnect
(`lib/integrations/manage.ts`), Google OAuth connect/callback
(`app/api/google/*`) and Google config/disconnect (`app/(admin)/actions/google.ts`),
and **Settings → AI Provider** (`app/(admin)/actions/ai-settings.ts` — choosing
the AI provider/model for the content pipeline, and saving, replacing,
removing and testing AI provider API keys). The Settings page itself is
`SETTINGS_MANAGEMENT`; Admins see the active AI provider there read-only.

The Google OAuth routes used to check a literal `role !== "ADMIN"` instead,
which backwards-blocked Super Admins; fixed 2026-10-22 (see
`docs/known-limitations.md`).
