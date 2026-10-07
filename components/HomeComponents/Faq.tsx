import { getFaqs } from "@/app/(admin)/actions/faqs";
import FaqClient from "./FaqClient";
import JsonLd from "@/components/JsonLd";
import { faqPageSchema } from "@/lib/schema";

export default async function Faq() {
  const dbFaqs = await getFaqs();
  return (
    <>
      {dbFaqs.length > 0 && <JsonLd schema={faqPageSchema(dbFaqs)} />}
      <FaqClient dbFaqs={dbFaqs} />
    </>
  );
}
