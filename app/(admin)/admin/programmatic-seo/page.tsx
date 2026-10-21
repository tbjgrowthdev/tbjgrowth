import Link from "next/link";
import { Plus } from "lucide-react";
import { getPSeoTemplates } from "../../actions/programmatic-seo";

export default async function ProgrammaticSeoList() {
  const templates = await getPSeoTemplates();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Programmatic SEO</h1>
          <p className="text-caption">Template + dataset combinations that generate landing pages, with quality guardrails deciding what actually goes live.</p>
        </div>
        <Link href="/admin/programmatic-seo/new" className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors whitespace-nowrap">
          <Plus size={18} />
          New Template
        </Link>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Template</th>
              <th className="px-6 py-4 font-medium text-caption">Datasets</th>
              <th className="px-6 py-4 font-medium text-caption">Pages</th>
              <th className="px-6 py-4 font-medium text-caption">Indexable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {templates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-caption">
                  No templates yet. Create one to start generating pages from a dataset.
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} className="hover:bg-background transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">
                    <Link href={`/admin/programmatic-seo/${t.id}`} className="hover:text-brand-orange-deep dark:hover:text-brand-orange-light">
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-caption">{t._count.datasets}</td>
                  <td className="px-6 py-4 text-caption">{t._count.pages}</td>
                  <td className="px-6 py-4 text-caption">{t.isIndexable ? "Yes" : "No"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
