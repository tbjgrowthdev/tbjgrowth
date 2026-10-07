import type { Role } from "@prisma/client";

export type Permission =
  | "VIEW"
  | "CREATE"
  | "EDIT"
  | "DELETE"
  | "PUBLISH"
  | "APPROVE"
  | "SCHEDULE"
  | "MEDIA_MANAGEMENT"
  | "SEO_MANAGEMENT"
  | "USER_MANAGEMENT"
  | "SETTINGS_MANAGEMENT"
  | "INTEGRATION_MANAGEMENT"
  | "EXPORT";

// Fixed role -> permission matrix. Not dynamic/admin-editable by design — the
// role list and the permission list are both closed sets from the spec.
//
// Reasoning for the non-obvious cuts:
// - CONTRIBUTOR can create/edit content but never delete, publish, approve,
//   schedule, or touch the shared media library/SEO tools/users/settings —
//   their work always has to pass through someone with APPROVE and then
//   someone with PUBLISH or SCHEDULE before it goes live.
// - SEO_MANAGER can EDIT content (to adjust meta/SEO fields on existing
//   content) but not CREATE/DELETE/PUBLISH it — their own domain is
//   SEO_MANAGEMENT (redirects, robots rules, keyword tracking) + EXPORT.
// - EDITOR gets the full content lifecycle (create/edit/delete/publish/
//   approve/schedule/media) but not the dedicated SEO tools, users, or
//   settings — matches the existing route-level restriction already in
//   middleware.ts before this system existed.
// - ADMIN gets everything except INTEGRATION_MANAGEMENT, which is reserved
//   for SUPER_ADMIN as the highest-risk surface (third-party API keys,
//   webhooks). ADMIN's USER_MANAGEMENT is further scoped at the call site
//   (see canManageUser below) to exclude managing other Admins/Super Admins.
// - SUPER_ADMIN is unrestricted.
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "VIEW", "CREATE", "EDIT", "DELETE", "PUBLISH", "APPROVE", "SCHEDULE",
    "MEDIA_MANAGEMENT", "SEO_MANAGEMENT", "USER_MANAGEMENT",
    "SETTINGS_MANAGEMENT", "INTEGRATION_MANAGEMENT", "EXPORT",
  ],
  ADMIN: [
    "VIEW", "CREATE", "EDIT", "DELETE", "PUBLISH", "APPROVE", "SCHEDULE",
    "MEDIA_MANAGEMENT", "SEO_MANAGEMENT", "USER_MANAGEMENT",
    "SETTINGS_MANAGEMENT", "EXPORT",
  ],
  EDITOR: [
    "VIEW", "CREATE", "EDIT", "DELETE", "PUBLISH", "APPROVE", "SCHEDULE",
    "MEDIA_MANAGEMENT",
  ],
  SEO_MANAGER: ["VIEW", "EDIT", "SEO_MANAGEMENT", "EXPORT"],
  CONTRIBUTOR: ["VIEW", "CREATE", "EDIT"],
};

export function hasPermission(role: Role | string | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role as Role];
  return perms ? perms.includes(permission) : false;
}

export function getPermissions(role: Role | string | undefined | null): Permission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role as Role] ?? [];
}

// ADMIN may manage EDITOR/SEO_MANAGER/CONTRIBUTOR accounts, but never ADMIN
// or SUPER_ADMIN accounts (prevents privilege escalation between admins, and
// prevents demoting/deleting the super admin). SUPER_ADMIN may manage anyone,
// including other Super Admins, except itself for destructive actions — that
// self-check is left to the caller since it needs the acting user's own id.
export function canManageUserWithRole(actingRole: Role | string, targetRole: Role | string): boolean {
  if (actingRole === "SUPER_ADMIN") return true;
  if (actingRole === "ADMIN") {
    return targetRole === "EDITOR" || targetRole === "SEO_MANAGER" || targetRole === "CONTRIBUTOR";
  }
  return false;
}

export const ALL_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "EDITOR", "SEO_MANAGER", "CONTRIBUTOR"];
