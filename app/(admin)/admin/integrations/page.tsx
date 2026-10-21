import { getProviderFieldDefsAction, listIntegrationStatusesAction } from "@/app/(admin)/actions/integrations";
import IntegrationHubClient from "@/components/Admin/Integrations/IntegrationHubClient";

export default async function IntegrationsPage() {
  const [statuses, fieldDefs] = await Promise.all([listIntegrationStatusesAction(), getProviderFieldDefsAction()]);
  return <IntegrationHubClient statuses={statuses} fieldDefs={fieldDefs} />;
}
