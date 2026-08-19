"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertCircle } from "lucide-react";
import DeleteButton from "./DeleteButton";

type TaxonomyItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  _count?: { posts: number };
};

export default function TaxonomyManager({
  entityName,
  items,
  createAction,
  deleteAction,
  showDescription = false,
}: {
  entityName: string;
  items: TaxonomyItem[];
  createAction: (data: { name: string; description?: string }) => Promise<{ success: boolean; error?: string }>;
  deleteAction: (id: string) => Promise<{ success: boolean; error?: string }>;
  showDescription?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await createAction({ name, description: description || undefined });
    if (result.success) {
      setName("");
      setDescription("");
      router.refresh();
    } else {
      setError(result.error || `Failed to create ${entityName}`);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3"
      >
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`New ${entityName} name`}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500"
        />
        {showDescription && (
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500"
          />
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Plus size={18} />
          Add
        </button>
      </form>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Name</th>
              <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Slug</th>
              <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Posts</th>
              <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  No {entityName}s yet. Add your first one above.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{item.name}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{item.slug}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{item._count?.posts ?? 0}</td>
                  <td className="px-6 py-4 text-right">
                    <DeleteButton id={item.id} onDelete={deleteAction} entityName={entityName} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
