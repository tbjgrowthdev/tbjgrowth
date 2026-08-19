import { getSystem } from "@/app/(admin)/actions/systems";
import SystemForm from "@/components/Admin/SystemForm";
import { notFound } from "next/navigation";

export default async function EditSystem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSystem(id);

  if (!s) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Edit System: {s.title}</h1>
      <SystemForm initialData={s} />
    </div>
  );
}
