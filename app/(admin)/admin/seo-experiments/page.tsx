import Link from "next/link";
import { Plus } from "lucide-react";
import { getSeoExperiments } from "../../actions/seo-experiments";

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  RUNNING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  REVERTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const VARIABLE_LABEL: Record<string, string> = {
  TITLE: "Title",
  META_DESCRIPTION: "Meta Description",
  CTA: "CTA",
  INTERNAL_LINKS: "Internal Links",
  CONTENT_SECTION: "Content Section",
};

export default async function SeoExperimentsList() {
  const experiments = await getSeoExperiments();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SEO Experimentation</h1>
          <p className="text-caption">Sequential before/after tests on title, meta description, CTA, internal links, and content sections — one version live at a time.</p>
        </div>
        <Link href="/admin/seo-experiments/new" className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors whitespace-nowrap">
          <Plus size={18} />
          New Experiment
        </Link>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Experiment</th>
              <th className="px-6 py-4 font-medium text-caption">Content</th>
              <th className="px-6 py-4 font-medium text-caption">Variable</th>
              <th className="px-6 py-4 font-medium text-caption">Status</th>
              <th className="px-6 py-4 font-medium text-caption">Clicks Δ</th>
              <th className="px-6 py-4 font-medium text-caption">Position Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {experiments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-caption">
                  No experiments yet.
                </td>
              </tr>
            ) : (
              experiments.map((e) => (
                <tr key={e.id} className="hover:bg-background transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">
                    <Link href={`/admin/seo-experiments/${e.id}`} className="hover:text-brand-orange-deep dark:hover:text-brand-orange-light">
                      {e.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-caption">{e.content?.title ?? "(deleted)"}</td>
                  <td className="px-6 py-4 text-caption">{VARIABLE_LABEL[e.variable]}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_STYLE[e.status]}`}>{e.status}</span>
                  </td>
                  <td className="px-6 py-4 text-caption">
                    {e.results?.deltas.clicksPct != null ? `${e.results.deltas.clicksPct > 0 ? "+" : ""}${e.results.deltas.clicksPct.toFixed(0)}%` : "—"}
                  </td>
                  <td className="px-6 py-4 text-caption">
                    {e.results?.deltas.positionChange != null ? e.results.deltas.positionChange.toFixed(1) : "—"}
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
