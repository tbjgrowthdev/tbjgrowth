import { getCaseStudies, deleteCaseStudy } from "../../actions/cases";
import Link from "next/link";
import { Plus, Edit, Star } from "lucide-react";
import DeleteButton from "@/components/Admin/DeleteButton";

export default async function CaseStudiesList() {
  const caseStudies = await getCaseStudies();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Case Studies</h1>
        <Link 
          href="/admin/cases/new" 
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors"
        >
          <Plus size={18} />
          Create Case Study
        </Link>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Title</th>
              <th className="px-6 py-4 font-medium text-caption">Client / Industry</th>
              <th className="px-6 py-4 font-medium text-caption">Status</th>
              <th className="px-6 py-4 font-medium text-caption text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {caseStudies.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-caption">
                  No case studies found. Create your first case study!
                </td>
              </tr>
            ) : (
              caseStudies.map((caseStudy) => (
                <tr key={caseStudy.id} className="hover:bg-background transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      {caseStudy.isFeatured && (
                        <Star size={14} className="text-yellow-500 fill-yellow-500 flex-shrink-0" />
                      )}
                      {caseStudy.title}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-caption">{caseStudy.clientName} - {caseStudy.industry}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      caseStudy.status === 'PUBLISHED' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {caseStudy.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-3">
                    <Link href={`/admin/cases/${caseStudy.id}`} className="text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light dark:hover:text-brand-orange">
                      <Edit size={18} />
                    </Link>
                    <DeleteButton id={caseStudy.id} onDelete={deleteCaseStudy} entityName="case study" />
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
