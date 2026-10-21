import prisma from "@/lib/prisma";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { revalidatePath } from "next/cache";
import { decryptJson, encryptJson } from "./crypto";
import { getAiProviderMirrorStatus, getEmailMirrorStatus, getGoogleMirrorStatuses } from "./mirror";
import { PROVIDER_REGISTRY } from "./registry";
import type { IntegrationProvider, IntegrationStatusView } from "./types";

type StageResult<T> = { success: true; data: T } | { success: false; error: string };

function fail(error: string): StageResult<never> {
  return { success: false, error };
}

function metadataSummaryFrom(metadata: string | null): string | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as Record<string, string>;
    const parts = Object.values(parsed).filter(Boolean);
    return parts.length ? parts.join(" · ") : null;
  } catch {
    return null;
  }
}

function toView(row: {
  provider: IntegrationProvider;
  status: string;
  lastError: string | null;
  lastCheckedAt: Date | null;
  connectedAt: Date | null;
  metadata: string | null;
}): IntegrationStatusView {
  const def = PROVIDER_REGISTRY[row.provider];
  return {
    id: row.provider,
    label: def?.label ?? row.provider,
    category: def?.category ?? "Other",
    status: row.status as IntegrationStatusView["status"],
    lastError: row.lastError,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    connectedAt: row.connectedAt?.toISOString() ?? null,
    metadataSummary: metadataSummaryFrom(row.metadata),
    managedBy: "hub",
    manageHref: null,
    provider: row.provider,
    liveTestAvailable: !!def?.testConnection,
  };
}

/** Every provider's current status — the hub-owned rows plus the three mirrored sources. Read-only; VIEW-level session, same as any other admin list. */
export async function listIntegrationStatuses(): Promise<IntegrationStatusView[]> {
  await requireSession();

  const hubRows = await prisma.integration.findMany();
  const hubByProvider = new Map(hubRows.map((r) => [r.provider, r]));

  const hubViews = Object.keys(PROVIDER_REGISTRY).map((provider) => {
    const row = hubByProvider.get(provider as IntegrationProvider);
    if (row) return toView(row);
    const def = PROVIDER_REGISTRY[provider];
    return {
      id: provider,
      label: def.label,
      category: def.category,
      status: "DISCONNECTED" as const,
      lastError: null,
      lastCheckedAt: null,
      connectedAt: null,
      metadataSummary: null,
      managedBy: "hub" as const,
      manageHref: null,
      provider: provider as IntegrationProvider,
      liveTestAvailable: !!def.testConnection,
    };
  });

  const [googleViews, aiView, emailView] = await Promise.all([getGoogleMirrorStatuses(), Promise.resolve(getAiProviderMirrorStatus()), Promise.resolve(getEmailMirrorStatus())]);

  return [...googleViews, aiView, emailView, ...hubViews];
}

/**
 * Saves (or replaces) a provider's credentials. Runs the provider's live
 * test first when one exists, so the stored status always reflects
 * reality rather than "saved, assumed fine" — credentials are stored
 * either way (a failed test might still be the right credentials hitting
 * a transient network issue), with the test's own result recorded as
 * CONNECTED or ERROR. Providers with no testConnection (CRM, no named
 * vendor) go straight to CONNECTED with no independent verification —
 * the admin UI says so rather than implying a check that didn't happen.
 */
export async function saveIntegrationCredentials(provider: IntegrationProvider, credentials: Record<string, string>): Promise<StageResult<IntegrationStatusView>> {
  try {
    const session = await requirePermission("INTEGRATION_MANAGEMENT");
    const def = PROVIDER_REGISTRY[provider];
    if (!def) return fail("Unknown provider");

    const missing = def.fields.filter((f) => f.required && !credentials[f.name]?.trim());
    if (missing.length > 0) return fail(`Missing required field(s): ${missing.map((f) => f.label).join(", ")}`);

    const testResult = def.testConnection ? await def.testConnection(credentials) : { ok: true };
    const encryptedCredentials = encryptJson(credentials);
    const existing = await prisma.integration.findUnique({ where: { provider } });

    const row = await prisma.integration.upsert({
      where: { provider },
      create: {
        provider,
        encryptedCredentials,
        status: testResult.ok ? "CONNECTED" : "ERROR",
        lastError: testResult.ok ? null : testResult.error || "Connection test failed",
        lastCheckedAt: def.testConnection ? new Date() : null,
        connectedAt: testResult.ok ? new Date() : null,
        metadata: testResult.metadata ? JSON.stringify(testResult.metadata) : null,
        connectedById: session.user.id,
      },
      update: {
        encryptedCredentials,
        status: testResult.ok ? "CONNECTED" : "ERROR",
        lastError: testResult.ok ? null : testResult.error || "Connection test failed",
        lastCheckedAt: def.testConnection ? new Date() : null,
        connectedAt: testResult.ok ? new Date() : existing?.connectedAt ?? null,
        metadata: testResult.metadata ? JSON.stringify(testResult.metadata) : existing?.metadata ?? null,
        connectedById: session.user.id,
      },
    });

    await logAudit({
      action: existing ? "update" : "create",
      category: "Integrations",
      entityType: "Integration",
      entityId: row.id,
      entityLabel: def.label,
      before: existing ? { status: existing.status } : undefined,
      after: { status: row.status },
    });

    revalidatePath("/admin/integrations");
    return { success: true, data: toView(row) };
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to save credentials for integration ${provider}:`, error);
    return fail(error instanceof Error ? error.message : "Failed to save credentials");
  }
}

/** The "Reconnect" action — re-runs the live test against the already-stored credentials, without the admin re-entering them. */
export async function testIntegration(provider: IntegrationProvider): Promise<StageResult<IntegrationStatusView>> {
  try {
    await requirePermission("INTEGRATION_MANAGEMENT");
    const def = PROVIDER_REGISTRY[provider];
    if (!def) return fail("Unknown provider");
    if (!def.testConnection) return fail("No live check is available for this provider");

    const existing = await prisma.integration.findUnique({ where: { provider } });
    if (!existing?.encryptedCredentials) return fail("Not connected yet — add credentials first");

    const credentials = decryptJson<Record<string, string>>(existing.encryptedCredentials);
    const testResult = await def.testConnection(credentials);

    const row = await prisma.integration.update({
      where: { provider },
      data: {
        status: testResult.ok ? "CONNECTED" : "ERROR",
        lastError: testResult.ok ? null : testResult.error || "Connection test failed",
        lastCheckedAt: new Date(),
        connectedAt: testResult.ok ? existing.connectedAt ?? new Date() : existing.connectedAt,
        metadata: testResult.metadata ? JSON.stringify(testResult.metadata) : existing.metadata,
      },
    });

    revalidatePath("/admin/integrations");
    return { success: true, data: toView(row) };
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to test integration ${provider}:`, error);
    return fail(error instanceof Error ? error.message : "Connection test failed");
  }
}

export async function disconnectIntegration(provider: IntegrationProvider): Promise<StageResult<null>> {
  try {
    await requirePermission("INTEGRATION_MANAGEMENT");
    const existing = await prisma.integration.findUnique({ where: { provider } });
    if (existing) {
      await prisma.integration.delete({ where: { provider } });
      await logAudit({
        action: "delete",
        category: "Integrations",
        entityType: "Integration",
        entityId: existing.id,
        entityLabel: PROVIDER_REGISTRY[provider]?.label ?? provider,
        before: { status: existing.status },
      });
    }
    revalidatePath("/admin/integrations");
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to disconnect integration ${provider}:`, error);
    return fail("Failed to disconnect");
  }
}
