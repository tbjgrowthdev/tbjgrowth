import { getService } from "@/app/(admin)/actions/services";
import ServiceForm from "@/components/Admin/ServiceForm";
import { notFound } from "next/navigation";

export default async function EditService({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = await getService(id);

  if (!service) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Edit Service: {service.title}</h1>
      <ServiceForm initialData={service} />
    </div>
  );
}
