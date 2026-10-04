import { getFaq } from "@/app/(admin)/actions/faqs";
import FaqForm from "@/components/Admin/FaqForm";
import { notFound } from "next/navigation";

export default async function EditFaq({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await getFaq(id);

  if (!f) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Edit Question</h1>
      <FaqForm initialData={f} />
    </div>
  );
}
