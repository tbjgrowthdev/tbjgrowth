import TestimonialForm from "@/components/Admin/TestimonialForm";
import PageTitle from "@/components/Admin/PageTitle";

export default function NewTestimonial() {
  return (
    <div>
      <PageTitle className="mb-6">Create New Testimonial</PageTitle>
      <TestimonialForm />
    </div>
  );
}
