import { getTestimonial } from "@/app/(admin)/actions/testimonials";
import TestimonialForm from "@/components/Admin/TestimonialForm";
import { notFound } from "next/navigation";
import PageTitle from "@/components/Admin/PageTitle";

export default async function EditTestimonial({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTestimonial(id);

  if (!t) {
    notFound();
  }

  return (
    <div>
      <PageTitle className="mb-6">Edit Testimonial: {t.clientName}</PageTitle>
      <TestimonialForm initialData={t} />
    </div>
  );
}
