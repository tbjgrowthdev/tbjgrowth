import { notFound } from "next/navigation";
import ReusableBlockForm from "@/components/Admin/Blocks/ReusableBlockForm";
import { getBlockEditorOptions, getContentBlock } from "../../../actions/blocks";
import PageTitle from "@/components/Admin/PageTitle";

export default async function EditReusableBlock({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [found, { testimonials, faqs, packages }] = await Promise.all([getContentBlock(id), getBlockEditorOptions()]);
  if (!found) notFound();
  const { block, usage } = found;

  return (
    <div>
      <PageTitle className="mb-6">Edit Reusable Block: {block.name}</PageTitle>
      <ReusableBlockForm
        initial={{ id: block.id, name: block.name, type: block.type, data: block.data }}
        usage={usage}
        options={{ testimonials, faqs, packages }}
      />
    </div>
  );
}
