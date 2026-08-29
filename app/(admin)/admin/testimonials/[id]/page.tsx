import { getTestimonial } from "@/app/(admin)/actions/testimonials";
import TestimonialForm from "@/components/Admin/TestimonialForm";
import { notFound } from "next/navigation";

export default async function EditTestimonial({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTestimonial(id);

  if (!t) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Edit Testimonial: {t.clientName}</h1>
      <TestimonialForm initialData={t} />
    </div>
  );
}
