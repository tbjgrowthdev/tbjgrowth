import { getExecutiveAnalyticsAction } from "@/app/(admin)/actions/executive-analytics";
import ExecutiveAnalyticsClient from "@/components/Admin/ExecutiveAnalytics/ExecutiveAnalyticsClient";

export default async function ExecutiveAnalyticsPage() {
  const data = await getExecutiveAnalyticsAction(30);
  return <ExecutiveAnalyticsClient initialData={data} initialDays={30} />;
}
