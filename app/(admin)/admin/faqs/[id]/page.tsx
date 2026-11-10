import { getFaq } from "@/app/(admin)/actions/faqs";
import FaqForm from "@/components/Admin/FaqForm";
import { notFound } from "next/navigation";
import PageTitle from "@/components/Admin/PageTitle";

export default async function EditFaq({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await getFaq(id);

  if (!f) {
    notFound();
  }

  return (
    <div>
      <PageTitle className="mb-6">Edit Question</PageTitle>
      <FaqForm initialData={f} />
    </div>
  );
}
