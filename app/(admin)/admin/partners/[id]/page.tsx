import { getPartner } from "@/app/(admin)/actions/partners";
import PartnerForm from "@/components/Admin/PartnerForm";
import { notFound } from "next/navigation";

export default async function EditPartner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPartner(id);

  if (!p) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Edit Partner: {p.name}</h1>
      <PartnerForm initialData={p} />
    </div>
  );
}
