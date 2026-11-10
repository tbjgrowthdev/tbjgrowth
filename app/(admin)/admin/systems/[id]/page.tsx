import { getSystem } from "@/app/(admin)/actions/systems";
import SystemForm from "@/components/Admin/SystemForm";
import { notFound } from "next/navigation";
import PageTitle from "@/components/Admin/PageTitle";

export default async function EditSystem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSystem(id);

  if (!s) {
    notFound();
  }

  return (
    <div>
      <PageTitle className="mb-6">Edit System: {s.title}</PageTitle>
      <SystemForm initialData={s} />
    </div>
  );
}
