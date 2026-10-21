import type { IntegrationProvider } from "@/lib/generated/prisma/client";

export type { IntegrationProvider };

export interface IntegrationField {
  name: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder?: string;
  required: boolean;
}

export interface TestResult {
  ok: boolean;
  error?: string;
  /** Small, non-secret facts about the connection (e.g. team/site name) — stored as Integration.metadata, never a credential. */
  metadata?: Record<string, string>;
}

export interface ProviderDefinition {
  id: IntegrationProvider;
  label: string;
  category: string;
  description: string;
  fields: IntegrationField[];
  testConnection?: (credentials: Record<string, string>) => Promise<TestResult>;
}

// What the client actually needs to render a connect form — ProviderDefinition
// minus the server-only testConnection function (not serializable, and has
// no business being shipped to the browser anyway).
export type ProviderFieldDefinition = Omit<ProviderDefinition, "testConnection">;

export type ManagedBy = "hub" | "google-oauth" | "env";

export interface IntegrationStatusView {
  id: string;
  label: string;
  category: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  lastError: string | null;
  lastCheckedAt: string | null; // ISO string — these views cross the server/client boundary as plain data
  connectedAt: string | null;
  metadataSummary: string | null;
  managedBy: ManagedBy;
  manageHref: string | null;
  /** Only set for managedBy "hub" — which Integration row/provider this maps to, for the connect/test/disconnect actions. */
  provider: IntegrationProvider | null;
  liveTestAvailable: boolean;
}
