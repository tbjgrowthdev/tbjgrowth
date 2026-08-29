import { getServices, deleteService } from "../../actions/services";
import Link from "next/link";
import { Plus, Edit } from "lucide-react";
import DeleteButton from "@/components/Admin/DeleteButton";

export default async function ServicesList() {
  const services = await getServices();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Agency Services</h1>
        <Link 
          href="/admin/services/new" 
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors"
        >
          <Plus size={18} />
          Add Service
        </Link>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Title</th>
              <th className="px-6 py-4 font-medium text-caption">Order</th>
              <th className="px-6 py-4 font-medium text-caption text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {services.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-caption">
                  No services found. Add your first service card!
                </td>
              </tr>
            ) : (
              services.map((service) => (
                <tr key={service.id} className="hover:bg-background transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{service.title}</td>
                  <td className="px-6 py-4 text-caption">{service.order}</td>
                  <td className="px-6 py-4 text-right flex justify-end gap-3">
                    <Link href={`/admin/services/${service.id}`} className="text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light dark:hover:text-brand-orange">
                      <Edit size={18} />
                    </Link>
                    <DeleteButton id={service.id} onDelete={deleteService} entityName="service" />
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
