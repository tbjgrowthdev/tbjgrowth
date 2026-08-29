import { getCaseStudy } from "@/app/(admin)/actions/cases";
import CaseStudyForm from "@/components/Admin/CaseStudyForm";
import { notFound } from "next/navigation";

export default async function EditCaseStudy({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caseStudy = await getCaseStudy(id);

  if (!caseStudy) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Edit Case Study: {caseStudy.title}</h1>
      <CaseStudyForm initialData={caseStudy} />
    </div>
  );
}
