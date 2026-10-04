import { getFaqs, deleteFaq } from "../../actions/faqs";
import Link from "next/link";
import { Plus, Edit } from "lucide-react";
import DeleteButton from "@/components/Admin/DeleteButton";

export default async function FaqsList() {
  const faqs = await getFaqs();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">FAQ</h1>
        <Link
          href="/admin/faqs/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors"
        >
          <Plus size={18} />
          Add Question
        </Link>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Question</th>
              <th className="px-6 py-4 font-medium text-caption">Order</th>
              <th className="px-6 py-4 font-medium text-caption text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {faqs.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-caption">
                  No FAQs found. Add your first question!
                </td>
              </tr>
            ) : (
              faqs.map((f) => (
                <tr key={f.id} className="hover:bg-background transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground max-w-xl truncate">{f.question}</td>
                  <td className="px-6 py-4 text-caption">{f.order}</td>
                  <td className="px-6 py-4 text-right flex justify-end gap-3">
                    <Link href={`/admin/faqs/${f.id}`} className="text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light dark:hover:text-brand-orange">
                      <Edit size={18} />
                    </Link>
                    <DeleteButton id={f.id} onDelete={deleteFaq} entityName="question" />
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
