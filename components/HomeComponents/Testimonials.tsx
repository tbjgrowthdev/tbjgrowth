import { getTestimonials } from "@/app/(admin)/actions/testimonials";
import TestimonialsClient from "./TestimonialsClient";

export default async function Testimonials() {
  const dbTestimonials = await getTestimonials();
  return <TestimonialsClient dbTestimonials={dbTestimonials} />;
}