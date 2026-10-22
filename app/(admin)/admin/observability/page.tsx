import { getObservabilityDataAction } from "@/app/(admin)/actions/observability";
import ObservabilityClient from "@/components/Admin/Observability/ObservabilityClient";

export default async function ObservabilityPage() {
  const data = await getObservabilityDataAction(24);
  return <ObservabilityClient initialData={data} initialHours={24} />;
}
