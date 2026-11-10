import CaseStudyForm from "@/components/Admin/CaseStudyForm";
import PageTitle from "@/components/Admin/PageTitle";

export default function NewCaseStudy() {
  return (
    <div>
      <PageTitle className="mb-6">Create New Case Study</PageTitle>
      <CaseStudyForm />
    </div>
  );
}
