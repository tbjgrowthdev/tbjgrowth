import Link from "next/link";
import { Plus, Edit } from "lucide-react";
import { getContentBlocks, getContentBlockUsageCounts, deleteContentBlock } from "../../actions/blocks";
import DeleteButton from "@/components/Admin/DeleteButton";
import { BLOCK_LABELS } from "@/lib/blocks/fields";
import type { BlockType } from "@/lib/blocks/types";

export default async function ReusableBlocksList() {
  const [blocks, usage] = await Promise.all([getContentBlocks(), getContentBlockUsageCounts()]);

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold text-foreground">Reusable Blocks</h1>
        <Link href="/admin/blocks/new" className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors">
          <Plus size={18} />
          New Block
        </Link>
      </div>
      <p className="text-sm text-caption mb-6">
        Shared landing-page blocks (calls to action, FAQs, lead forms…). Add one to any page or programmatic SEO template; editing it here updates
        every place that uses it.
      </p>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Name</th>
              <th className="px-6 py-4 font-medium text-caption">Type</th>
              <th className="px-6 py-4 font-medium text-caption">Used in</th>
              <th className="px-6 py-4 font-medium text-caption">Updated</th>
              <th className="px-6 py-4 font-medium text-caption text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {blocks.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-caption">No reusable blocks yet.</td></tr>
            ) : (
              blocks.map((b) => (
                <tr key={b.id} className="hover:bg-background transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{b.name}</td>
                  <td className="px-6 py-4 text-caption">{BLOCK_LABELS[b.type as BlockType] ?? b.type}</td>
                  <td className="px-6 py-4 text-caption">{usage[b.id] ?? 0}</td>
                  <td className="px-6 py-4 text-caption">{b.updatedAt.toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right flex justify-end gap-3">
                    <Link href={`/admin/blocks/${b.id}`} aria-label={`Edit ${b.name}`} className="text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light dark:hover:text-brand-orange">
                      <Edit size={18} />
                    </Link>
                    <DeleteButton id={b.id} onDelete={deleteContentBlock} entityName="block" />
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
