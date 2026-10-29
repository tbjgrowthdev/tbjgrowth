"use server";

import { disconnectIntegration, listIntegrationStatuses, saveIntegrationCredentials, testIntegration } from "@/lib/integrations/manage";
import { listProviderFieldDefs } from "@/lib/integrations/registry";
import type { IntegrationProvider } from "@/lib/integrations/types";
import { guardMutation, guardRead } from "@/lib/action-guard";

export async function listIntegrationStatusesAction() {
  return guardRead("SESSION", () => [], () => listIntegrationStatuses());
}

export async function getProviderFieldDefsAction() {
  return guardRead("SESSION", () => [], async () => listProviderFieldDefs());
}

export async function saveIntegrationCredentialsAction(provider: IntegrationProvider, credentials: Record<string, string>) {
  return guardMutation("INTEGRATION_MANAGEMENT", () => saveIntegrationCredentials(provider, credentials));
}

export async function testIntegrationAction(provider: IntegrationProvider) {
  return guardMutation("INTEGRATION_MANAGEMENT", () => testIntegration(provider));
}

export async function disconnectIntegrationAction(provider: IntegrationProvider) {
  return guardMutation("INTEGRATION_MANAGEMENT", () => disconnectIntegration(provider));
}
