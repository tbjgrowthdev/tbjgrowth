import { getPage } from "@/app/(admin)/actions/pages";
import PageForm from "@/components/Admin/PageForm";
import { notFound } from "next/navigation";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getPage(id);

  if (!page) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Edit Page: {page.title}</h1>
      <PageForm initialData={page} />
    </div>
  );
}
