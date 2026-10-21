"use server";

import { disconnectIntegration, listIntegrationStatuses, saveIntegrationCredentials, testIntegration } from "@/lib/integrations/manage";
import { listProviderFieldDefs } from "@/lib/integrations/registry";
import type { IntegrationProvider } from "@/lib/integrations/types";

export async function listIntegrationStatusesAction() {
  return listIntegrationStatuses();
}

export async function getProviderFieldDefsAction() {
  return listProviderFieldDefs();
}

export async function saveIntegrationCredentialsAction(provider: IntegrationProvider, credentials: Record<string, string>) {
  return saveIntegrationCredentials(provider, credentials);
}

export async function testIntegrationAction(provider: IntegrationProvider) {
  return testIntegration(provider);
}

export async function disconnectIntegrationAction(provider: IntegrationProvider) {
  return disconnectIntegration(provider);
}
