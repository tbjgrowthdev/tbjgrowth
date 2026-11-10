import PSeoTemplateForm from "@/components/Admin/PSeoTemplateForm";
import PageTitle from "@/components/Admin/PageTitle";

export default function NewPSeoTemplate() {
  return (
    <div>
      <PageTitle className="mb-6">New Programmatic SEO Template</PageTitle>
      <PSeoTemplateForm />
    </div>
  );
}
