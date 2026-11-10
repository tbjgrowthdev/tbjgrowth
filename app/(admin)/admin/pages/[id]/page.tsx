import { getPage } from "@/app/(admin)/actions/pages";
import PageForm from "@/components/Admin/PageForm";
import { notFound } from "next/navigation";
import PageTitle from "@/components/Admin/PageTitle";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getPage(id);

  if (!page) {
    notFound();
  }

  return (
    <div>
      <PageTitle className="mb-6">Edit Page: {page.title}</PageTitle>
      <PageForm initialData={page} />
    </div>
  );
}
