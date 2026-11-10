import { getPartner } from "@/app/(admin)/actions/partners";
import PartnerForm from "@/components/Admin/PartnerForm";
import { notFound } from "next/navigation";
import PageTitle from "@/components/Admin/PageTitle";

export default async function EditPartner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPartner(id);

  if (!p) {
    notFound();
  }

  return (
    <div>
      <PageTitle className="mb-6">Edit Partner: {p.name}</PageTitle>
      <PartnerForm initialData={p} />
    </div>
  );
}
