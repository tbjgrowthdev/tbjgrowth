import Link from "next/link";
import { listPromptTemplatesAction } from "@/app/(admin)/actions/content-pipeline";
import { CATEGORY_LABEL, WIRED_CATEGORIES } from "@/lib/content-pipeline/prompt-library";

export default async function PromptLibraryPage() {
  const rows = await listPromptTemplatesAction();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/ai-pipeline" className="text-sm text-caption hover:text-foreground">
          ← AI Content Pipeline
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-1">AI Prompt Library</h1>
        <p className="text-caption">
          Editable, versioned prompts behind the content pipeline. Blog, Case Study, and SEO are read by a live stage today; the rest are ready to author
          ahead of the feature that will eventually use them.
        </p>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Category</th>
              <th className="px-6 py-4 font-medium text-caption">Active version</th>
              <th className="px-6 py-4 font-medium text-caption">Updated by</th>
              <th className="px-6 py-4 font-medium text-caption">Updated</th>
              <th className="px-6 py-4 font-medium text-caption">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ category, template, updatedByName }) => (
              <tr key={category} className="hover:bg-background transition-colors">
                <td className="px-6 py-4 font-medium text-foreground">
                  <Link href={`/admin/ai-pipeline/prompts/${category}`} className="hover:text-brand-orange-deep dark:hover:text-brand-orange-light">
                    {CATEGORY_LABEL[category]}
                  </Link>
                </td>
                <td className="px-6 py-4 text-caption">
                  {template?.activeVersion ? `v${template.activeVersion.versionNumber}` : <span className="italic">Not created yet</span>}
                </td>
                <td className="px-6 py-4 text-caption">{updatedByName || "—"}</td>
                <td className="px-6 py-4 text-caption">{template ? new Date(template.updatedAt).toLocaleDateString() : "—"}</td>
                <td className="px-6 py-4">
                  {WIRED_CATEGORIES.includes(category) ? (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Live in pipeline
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-tint text-caption">No stage yet</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
