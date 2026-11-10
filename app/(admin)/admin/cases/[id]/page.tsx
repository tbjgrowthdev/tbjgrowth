import { getCaseStudy } from "@/app/(admin)/actions/cases";
import CaseStudyForm from "@/components/Admin/CaseStudyForm";
import { notFound } from "next/navigation";
import PageTitle from "@/components/Admin/PageTitle";

export default async function EditCaseStudy({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caseStudy = await getCaseStudy(id);

  if (!caseStudy) {
    notFound();
  }

  return (
    <div>
      <PageTitle className="mb-6">Edit Case Study: {caseStudy.title}</PageTitle>
      <CaseStudyForm initialData={caseStudy} />
    </div>
  );
}
