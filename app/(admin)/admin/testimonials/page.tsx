import { getTestimonials, deleteTestimonial } from "../../actions/testimonials";
import Link from "next/link";
import { Plus, Edit } from "lucide-react";
import DeleteButton from "@/components/Admin/DeleteButton";

export default async function TestimonialsList() {
  const testimonials = await getTestimonials();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Testimonials</h1>
        <Link 
          href="/admin/testimonials/new" 
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors"
        >
          <Plus size={18} />
          Add Testimonial
        </Link>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Client</th>
              <th className="px-6 py-4 font-medium text-caption">Company</th>
              <th className="px-6 py-4 font-medium text-caption text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {testimonials.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-caption">
                  No testimonials found. Add your first client review!
                </td>
              </tr>
            ) : (
              testimonials.map((t) => (
                <tr key={t.id} className="hover:bg-background transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{t.clientName}</td>
                  <td className="px-6 py-4 text-caption">{t.company}</td>
                  <td className="px-6 py-4 text-right flex justify-end gap-3">
                    <Link href={`/admin/testimonials/${t.id}`} className="text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light dark:hover:text-brand-orange">
                      <Edit size={18} />
                    </Link>
                    <DeleteButton id={t.id} onDelete={deleteTestimonial} entityName="testimonial" />
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
