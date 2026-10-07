import { getTestimonials } from "@/app/(admin)/actions/testimonials";
import TestimonialsClient from "./TestimonialsClient";
import JsonLd from "@/components/JsonLd";
import { reviewsSchema } from "@/lib/schema";

export default async function Testimonials() {
  const dbTestimonials = await getTestimonials();
  // Mirrors TestimonialsClient's own hasTestimonials check exactly — review
  // schema must never appear when the visible section shows none.
  const hasTestimonials = dbTestimonials.length > 0;

  return (
    <>
      {hasTestimonials && <JsonLd schema={reviewsSchema("TBJ Growth Tech", dbTestimonials)} />}
      <TestimonialsClient dbTestimonials={dbTestimonials} />
    </>
  );
}