import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ALL_ROLES } from "@/lib/permissions";
import type { Role } from "@prisma/client";

// The ten tracked categories — kept as a closed set so every call site
// commits to one of the named buckets rather than drifting into free text.
export type AuditCategory =
  | "Content"
  | "SEO"
  | "Settings"
  | "Users"
  | "Roles"
  | "Publishing"
  | "Approval"
  | "Media"
  | "Redirects"
  | "Integrations";

async function getRequestMeta() {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ipAddress = forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip") || null;
    const userAgent = h.get("user-agent");
    return { ipAddress, userAgent };
  } catch {
    // headers() throws outside a request context (e.g. a script) — audit
    // logging degrades to no IP/UA rather than failing the caller.
    return { ipAddress: null as string | null, userAgent: null as string | null };
  }
}

interface LogAuditParams {
  action: string; // e.g. "create" | "update" | "delete" | "publish" | "approve" | "login" — free-form verb
  category: AuditCategory;
  entityType: string; // "Post", "User", "Redirect", "SiteSetting", ...
  entityId?: string | null;
  entityLabel?: string | null; // human-readable snapshot (title/name/email) so the log reads without extra joins
  before?: unknown; // omit entirely on create
  after?: unknown; // omit entirely on delete
}

// Fire-and-forget by design: a failed audit write must never block or fail
// the real mutation it's recording. Call this AFTER the mutation succeeds,
// with the session/IP/user-agent resolved internally so call sites only
// pass what actually changed.
export async function logAudit(params: LogAuditParams) {
  try {
    const session = await getServerSession(authOptions);
    const { ipAddress, userAgent } = await getRequestMeta();
    const sessionRole = session?.user?.role;
    const userRole: Role | null = sessionRole && (ALL_ROLES as string[]).includes(sessionRole) ? (sessionRole as Role) : null;

    await prisma.auditLog.create({
      data: {
        userId: session?.user?.id || null,
        userName: session?.user?.name || null,
        userEmail: session?.user?.email || null,
        userRole,
        action: params.action,
        category: params.category,
        entityType: params.entityType,
        entityId: params.entityId || null,
        entityLabel: params.entityLabel || null,
        before: params.before !== undefined ? JSON.stringify(params.before) : null,
        after: params.after !== undefined ? JSON.stringify(params.after) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
