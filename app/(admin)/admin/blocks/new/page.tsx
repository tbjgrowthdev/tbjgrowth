import ReusableBlockForm from "@/components/Admin/Blocks/ReusableBlockForm";
import { getBlockEditorOptions } from "../../../actions/blocks";
import PageTitle from "@/components/Admin/PageTitle";

export default async function NewReusableBlock() {
  const { testimonials, faqs, packages } = await getBlockEditorOptions();
  return (
    <div>
      <PageTitle className="mb-6">New Reusable Block</PageTitle>
      <ReusableBlockForm options={{ testimonials, faqs, packages }} />
    </div>
  );
}
