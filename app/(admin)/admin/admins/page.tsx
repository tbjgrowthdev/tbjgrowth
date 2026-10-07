import { getAdmins, deleteAdmin, updateAdminRole } from "@/app/(admin)/actions/admins";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ALL_ROLES } from "@/lib/permissions";
import Link from "next/link";
import Image from "next/image";
import { Plus, ShieldAlert, ShieldCheck, Search, PenLine, UserCog } from "lucide-react";
import DeleteButton from "@/components/Admin/DeleteButton";
import RoleSelect from "@/components/Admin/RoleSelect";
import { isValidImageSrc } from "@/lib/utils";
import type { Role } from "@prisma/client";

const ROLE_BADGE: Record<Role, { label: string; className: string; icon: typeof ShieldAlert }> = {
  SUPER_ADMIN: { label: "Super Admin", className: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400", icon: ShieldAlert },
  ADMIN: { label: "Admin", className: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400", icon: ShieldAlert },
  EDITOR: { label: "Editor", className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400", icon: ShieldCheck },
  SEO_MANAGER: { label: "SEO Manager", className: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400", icon: Search },
  CONTRIBUTOR: { label: "Contributor", className: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400", icon: PenLine },
};

// What roles the acting user may assign to someone else — mirrors
// canManageUserWithRole in lib/permissions.ts (duplicated here only because
// that function needs a target role too; this is just "all roles I can set").
function assignableRolesFor(actingRole: string): Role[] {
  if (actingRole === "SUPER_ADMIN") return ALL_ROLES;
  if (actingRole === "ADMIN") return ["EDITOR", "SEO_MANAGER", "CONTRIBUTOR"];
  return [];
}

export default async function AdminsPage() {
  const [admins, session] = await Promise.all([getAdmins(), getServerSession(authOptions)]);
  const actingRole = session?.user?.role || "";
  const actingUserId = session?.user?.id;
  const assignableRoles = assignableRolesFor(actingRole);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Members</h1>
          <p className="text-caption">Manage who has access to this dashboard and what they can do.</p>
        </div>
        <Link
          href="/admin/admins/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors"
        >
          <Plus size={20} />
          Add Team Member
        </Link>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="px-6 py-4 text-sm font-semibold text-foreground">Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-foreground">Email</th>
                <th className="px-6 py-4 text-sm font-semibold text-foreground">Role</th>
                <th className="px-6 py-4 text-sm font-semibold text-foreground">Created</th>
                <th className="px-6 py-4 text-sm font-semibold text-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {admins.map((admin) => {
                const badge = ROLE_BADGE[admin.role];
                const Icon = badge.icon;
                const isSelf = admin.id === actingUserId;
                return (
                  <tr key={admin.id} className="hover:bg-background">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">
                          {isValidImageSrc(admin.image) ? (
                            <Image src={admin.image} alt={admin.name || "Admin"} fill className="object-cover" />
                          ) : (
                            <span>{admin.name ? admin.name.charAt(0) : "A"}</span>
                          )}
                        </div>
                        <span className="font-medium text-foreground">
                          {admin.name || "Unnamed User"}
                          {isSelf && <span className="text-caption text-xs ml-1.5">(you)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-caption">
                      {admin.email}
                    </td>
                    <td className="px-6 py-4">
                      {isSelf ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${badge.className} text-xs font-medium`}>
                          <Icon size={14} />
                          {badge.label}
                        </span>
                      ) : (
                        <RoleSelect id={admin.id} role={admin.role} assignableRoles={assignableRoles} onChange={updateAdminRole} />
                      )}
                    </td>
                    <td className="px-6 py-4 text-caption text-sm">
                      {new Date(admin.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!isSelf && assignableRoles.includes(admin.role) && (
                        <DeleteButton id={admin.id} onDelete={deleteAdmin} entityName="team member" />
                      )}
                    </td>
                  </tr>
                );
              })}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-caption">
                    No team members found. (You shouldn&apos;t see this if you&apos;re logged in!)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-2 text-sm text-caption bg-card border border-border rounded-xl p-4">
        <UserCog size={16} className="mt-0.5 flex-shrink-0" />
        <p>
          You can only change roles for, or remove, users at or below what your own role manages.
          Admins can manage Editors, SEO Managers, and Contributors — never other Admins or the Super Admin.
        </p>
      </div>
    </div>
  );
}
