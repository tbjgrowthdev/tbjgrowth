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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Members</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage who has access to this dashboard and what they can do.</p>
        </div>
        <Link
          href="/admin/admins/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add Team Member
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">Name</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">Email</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">Role</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">Created</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                        {admin.name ? admin.name.charAt(0) : "A"}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {admin.name || "Unnamed User"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
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
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DeleteButton id={admin.id} onDelete={deleteAdmin} entityName="team member" />
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
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
