import { getPartners, deletePartner } from "../../actions/partners";
import Link from "next/link";
import { Plus, Edit } from "lucide-react";
import DeleteButton from "@/components/Admin/DeleteButton";

export default async function PartnersList() {
  const partners = await getPartners();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Trusted Partners</h1>
        <Link 
          href="/admin/partners/new" 
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors"
        >
          <Plus size={18} />
          Add Partner
        </Link>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Name</th>
              <th className="px-6 py-4 font-medium text-caption">Order</th>
              <th className="px-6 py-4 font-medium text-caption text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {partners.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-caption">
                  No partners found. Add your first trusted partner!
                </td>
              </tr>
            ) : (
              partners.map((p) => (
                <tr key={p.id} className="hover:bg-background transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{p.name}</td>
                  <td className="px-6 py-4 text-caption">{p.order}</td>
                  <td className="px-6 py-4 text-right flex justify-end gap-3">
                    <Link href={`/admin/partners/${p.id}`} className="text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light dark:hover:text-brand-orange">
                      <Edit size={18} />
                    </Link>
                    <DeleteButton id={p.id} onDelete={deletePartner} entityName="partner" />
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
