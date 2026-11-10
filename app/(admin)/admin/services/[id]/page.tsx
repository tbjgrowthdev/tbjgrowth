import { getService } from "@/app/(admin)/actions/services";
import ServiceForm from "@/components/Admin/ServiceForm";
import { notFound } from "next/navigation";
import PageTitle from "@/components/Admin/PageTitle";

export default async function EditService({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = await getService(id);

  if (!service) {
    notFound();
  }

  return (
    <div>
      <PageTitle className="mb-6">Edit Service: {service.title}</PageTitle>
      <ServiceForm initialData={service} />
    </div>
  );
}
