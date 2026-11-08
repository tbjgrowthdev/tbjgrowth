import ReusableBlockForm from "@/components/Admin/Blocks/ReusableBlockForm";
import { getBlockEditorOptions } from "../../../actions/blocks";

export default async function NewReusableBlock() {
  const { testimonials, faqs, packages } = await getBlockEditorOptions();
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">New Reusable Block</h1>
      <ReusableBlockForm options={{ testimonials, faqs, packages }} />
    </div>
  );
}
