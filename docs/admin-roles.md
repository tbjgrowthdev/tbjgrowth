# Admin Roles

## The five roles

Defined as `enum Role` in `prisma/schema.prisma`, stored on `User.role`
(`@default(CONTRIBUTOR)`):

```prisma
enum Role {
  SUPER_ADMIN
  ADMIN
  EDITOR
  SEO_MANAGER
  CONTRIBUTOR
}
```

This is a **closed set, not admin-editable at runtime** — `lib/permissions.ts`
hard-codes which permissions each role gets (`ROLE_PERMISSIONS`), by design,
per the original spec. Adding a role means a schema migration plus a code
change to that map, not a UI action. See `docs/permission-matrix.md` for the
full role → permission table.

Rough intent of each role (the *why*, from `lib/permissions.ts`'s own
comments):

- **CONTRIBUTOR** — can create/edit content but never delete, publish,
  approve, schedule, or touch the shared media library/SEO tools/users/
  settings. Their work always passes through someone with `APPROVE` and then
  someone with `PUBLISH`/`SCHEDULE` before it goes live.
- **SEO_MANAGER** — owns the SEO tooling (redirects, keyword tracking, audits,
  etc.) and can `EDIT` existing content's SEO fields, but can't `CREATE`/
  `DELETE`/`PUBLISH` content itself.
- **EDITOR** — the full content lifecycle (create/edit/delete/publish/
  approve/schedule/media) but not the dedicated SEO tools, user management,
  or settings.
- **ADMIN** — everything except `INTEGRATION_MANAGEMENT`, which is reserved
  for `SUPER_ADMIN` as the highest-risk surface (third-party API keys,
  webhook secrets). `ADMIN`'s `USER_MANAGEMENT` is further scoped at the call
  site to exclude managing other `ADMIN`/`SUPER_ADMIN` accounts (see
  "Who can manage whom" below).
- **SUPER_ADMIN** — unrestricted.

## How a user gets a role

- **Bootstrap**: `lib/auth.ts`'s `authorize()` checks `prisma.user.count()`
  on every login attempt. If it's `0`, the very first successful login
  creates that user as `SUPER_ADMIN` on the spot — there is no other way to
  grant that role, since there's no existing admin yet to grant it. Every
  login after that goes through the standard password (+ optional TOTP)
  check against an existing `User` row.
- **Afterwards**: only through **Admin → Team** (`app/(admin)/admin/admins`),
  backed by `app/(admin)/actions/admins.ts`'s `createAdmin`/`updateAdminRole`.
  Both require `USER_MANAGEMENT` and are further restricted by
  `canManageUserWithRole` (below) — e.g. an `ADMIN` cannot create or promote
  someone to `ADMIN` or `SUPER_ADMIN`, and nobody can change their own role
  or delete their own account (`admins.ts` checks `target.id === session.user.id`
  explicitly).

## Who can manage whom

`lib/permissions.ts`'s `canManageUserWithRole(actingRole, targetRole)`:

| Acting role | Can manage (create/edit role/delete) |
|---|---|
| `SUPER_ADMIN` | Anyone, including other `SUPER_ADMIN` accounts (self-destructive actions like deleting your own account are blocked separately in `admins.ts`, not here) |
| `ADMIN` | `EDITOR`, `SEO_MANAGER`, `CONTRIBUTOR` only — never `ADMIN` or `SUPER_ADMIN` |
| `EDITOR` / `SEO_MANAGER` / `CONTRIBUTOR` | Nobody — these roles don't hold `USER_MANAGEMENT` at all, so they never reach this check (`requirePermission("USER_MANAGEMENT")` rejects them first) |

This is what prevents privilege escalation between admins (an `ADMIN` can't
promote a `CONTRIBUTOR` straight to `SUPER_ADMIN`, and can't demote/delete
the actual super admin).

## How role flows from login to every request

1. `lib/auth.ts` (`authOptions`): NextAuth v4, `CredentialsProvider`
   (email+password, +TOTP/backup code if `twoFactorEnabled`), **JWT session
   strategy** — not NextAuth's "database" strategy, because
   `CredentialsProvider` can't use it in v4. `jwt()` callback copies
   `user.role` and `user.sessionId` onto the token at sign-in; `session()`
   callback copies them onto `session.user` on every request.
2. `middleware.ts` gates every `/admin/*` **page** route on a valid session +
   role before the page even renders (first line of defense, route-level).
3. `lib/auth-guard.ts`'s `requireSession()`/`requirePermission(permission)`
   — called at the top of nearly every Server Action — is the **real**
   enforcement point, for two reasons:
   - A Server Action is invoked directly by its compiled id, not matched by
     `middleware.ts`'s route patterns, so route-level gating alone wouldn't
     cover it.
   - `requireSession()` also checks `isSessionRevoked(session.user.sessionId)`
     against the `AdminSession` table on **every single call**. Since the JWT
     itself stays cryptographically valid until it expires (30 days,
     `session.maxAge`), this `AdminSession.revokedAt` check is what actually
     makes "Revoke" in **Admin → My Profile → Active Sessions**
     (`app/(admin)/actions/security.ts`) take effect on the very next action a
     revoked device tries — not just at next natural token expiry. See
     `docs/runbooks/security.md`.
4. `requirePermission(permission)` calls `requireSession()` first, then
   `hasPermission(session.user.role, permission)` from `lib/permissions.ts`.
   A failure throws `AuthError`, which every action catches and turns into
   its normal `{ success: false, error }` shape rather than an unhandled
   rejection reaching the client as a 500.

## `AuthError` and `requireSession()`/`requirePermission()` — exact behavior

From `lib/auth-guard.ts`:

```ts
export class AuthError extends Error {}

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) {
    throw new AuthError("Not authenticated");
  }
  if (await isSessionRevoked(session.user.sessionId)) {
    throw new AuthError("This session has been revoked. Please sign in again.");
  }
  await touchAdminSession(session.user.sessionId);
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, permission)) {
    throw new AuthError(`Missing required permission: ${permission}`);
  }
  return session;
}
```

`touchAdminSession` updates `AdminSession.lastSeenAt` on every authenticated
action — that's the data behind the "last seen" timestamp in the Active
Sessions list, not a separate heartbeat mechanism.

## Future SSO note

Not implemented, but the schema already carries unused `Account`/`Session`/
`VerificationToken` models (NextAuth's standard adapter shape) specifically so
adding an OIDC/SAML provider later is additive. See
`docs/runbooks/security.md`'s "Future SSO readiness" section for what's
already in place and what still needs a real decision (role assignment for a
first-time SSO login isn't decided).
