import { getFaqs } from "@/app/(admin)/actions/faqs";
import FaqClient from "./FaqClient";

export default async function Faq() {
  const dbFaqs = await getFaqs();
  return <FaqClient dbFaqs={dbFaqs} />;
}
