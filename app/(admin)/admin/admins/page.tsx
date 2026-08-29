import { getAdmins, deleteAdmin } from "@/app/(admin)/actions/admins";
import Link from "next/link";
import { Plus, ShieldAlert, ShieldCheck } from "lucide-react";
import DeleteButton from "@/components/Admin/DeleteButton";

export default async function AdminsPage() {
  const admins = await getAdmins();

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
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-background">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                        {admin.name ? admin.name.charAt(0) : "A"}
                      </div>
                      <span className="font-medium text-foreground">
                        {admin.name || "Unnamed User"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-caption">
                    {admin.email}
                  </td>
                  <td className="px-6 py-4">
                    {admin.role === "ADMIN" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium">
                        <ShieldAlert size={14} />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium">
                        <ShieldCheck size={14} />
                        Editor
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-caption text-sm">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DeleteButton id={admin.id} onDelete={deleteAdmin} entityName="team member" />
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-caption">
                    No team members found. (You shouldn't see this if you're logged in!)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
