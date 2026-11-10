import FaqForm from "@/components/Admin/FaqForm";
import PageTitle from "@/components/Admin/PageTitle";

export default function NewFaq() {
  return (
    <div>
      <PageTitle className="mb-6">Add Question</PageTitle>
      <FaqForm />
    </div>
  );
}
