import { listPerformanceFeedbackAction } from "@/app/(admin)/actions/seo-performance-feedback";
import PerformanceFeedbackListClient from "@/components/Admin/SeoPerformanceFeedback/PerformanceFeedbackListClient";

export default async function SeoPerformanceFeedbackPage() {
  const rows = await listPerformanceFeedbackAction();
  return <PerformanceFeedbackListClient rows={rows} />;
}
