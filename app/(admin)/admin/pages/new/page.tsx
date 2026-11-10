import PageForm from "@/components/Admin/PageForm";
import PageTitle from "@/components/Admin/PageTitle";

export default function NewPage() {
  return (
    <div>
      <PageTitle className="mb-6">Create New Page</PageTitle>
      <PageForm />
    </div>
  );
}
