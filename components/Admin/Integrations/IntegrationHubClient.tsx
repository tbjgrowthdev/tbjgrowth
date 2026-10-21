"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, RefreshCw, XCircle } from "lucide-react";
import {
  disconnectIntegrationAction,
  listIntegrationStatusesAction,
  saveIntegrationCredentialsAction,
  testIntegrationAction,
} from "@/app/(admin)/actions/integrations";
import type { getProviderFieldDefsAction } from "@/app/(admin)/actions/integrations";
import type { IntegrationProvider } from "@/lib/integrations/types";

type StatusView = Awaited<ReturnType<typeof listIntegrationStatusesAction>>[number];
type FieldDef = Awaited<ReturnType<typeof getProviderFieldDefsAction>>[number];

const STATUS_STYLE: Record<StatusView["status"], string> = {
  CONNECTED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  DISCONNECTED: "bg-tint text-caption",
  ERROR: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_ICON: Record<StatusView["status"], typeof CheckCircle2> = {
  CONNECTED: CheckCircle2,
  DISCONNECTED: XCircle,
  ERROR: AlertCircle,
};

function ConnectForm({
  fieldDef,
  initialValues,
  onSave,
  onCancel,
}: {
  fieldDef: FieldDef;
  initialValues: Record<string, string>;
  onSave: (credentials: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(values);
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="space-y-3 pt-3 border-t border-border">
      <p className="text-xs text-caption">{fieldDef.description}</p>
      <p className="text-xs text-caption italic">Credentials are encrypted at rest and never shown again after saving.</p>
      {fieldDef.fields.map((f) => (
        <div key={f.name}>
          <label className="block text-xs font-medium text-caption mb-1">
            {f.label}
            {f.required && <span className="text-red-500"> *</span>}
          </label>
          <input
            type={f.type === "password" ? "password" : f.type === "url" ? "url" : "text"}
            value={values[f.name] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            placeholder={f.placeholder}
            required={f.required}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground"
          />
        </div>
      ))}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 bg-brand-orange-deep text-white text-xs font-medium rounded-lg hover:bg-brand-orange disabled:opacity-50"
        >
          {saving ? "Connecting…" : "Connect"}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 border border-border text-xs rounded-lg hover:bg-background">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function IntegrationHubClient({ statuses, fieldDefs }: { statuses: StatusView[]; fieldDefs: FieldDef[] }) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fieldDefByProvider = useMemo(() => new Map(fieldDefs.map((f) => [f.id, f])), [fieldDefs]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, StatusView[]>();
    for (const s of statuses) {
      const list = byCategory.get(s.category) ?? [];
      list.push(s);
      byCategory.set(s.category, list);
    }
    return Array.from(byCategory.entries());
  }, [statuses]);

  const handleSave = async (provider: IntegrationProvider, credentials: Record<string, string>) => {
    setError(null);
    const result = await saveIntegrationCredentialsAction(provider, credentials);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setExpandedId(null);
    router.refresh();
  };

  const handleTest = async (provider: IntegrationProvider) => {
    setBusyId(provider);
    setError(null);
    const result = await testIntegrationAction(provider);
    setBusyId(null);
    if (!result.success) setError(result.error);
    router.refresh();
  };

  const handleDisconnect = async (provider: IntegrationProvider) => {
    if (!confirm("Disconnect this integration? Stored credentials will be deleted.")) return;
    setBusyId(provider);
    setError(null);
    const result = await disconnectIntegrationAction(provider);
    setBusyId(null);
    if (!result.success) setError(result.error);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integration Hub</h1>
        <p className="text-caption">
          One place to see every integration&apos;s status. Google Search Console/Analytics, AI providers, and email are managed by their own
          dedicated setup elsewhere — this hub mirrors their status rather than storing a second copy of their credentials. Everything else
          stores its credentials here, encrypted at rest.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {grouped.map(([category, items]) => (
        <div key={category} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((item) => {
              const Icon = STATUS_ICON[item.status];
              const isExpanded = expandedId === item.id;
              const fieldDef = item.provider ? fieldDefByProvider.get(item.provider) : undefined;
              const isBusy = busyId === item.provider;

              return (
                <div key={item.id} className="bg-card p-4 rounded-lg shadow-sm border border-border space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{item.label}</p>
                      {item.metadataSummary && <p className="text-xs text-caption">{item.metadataSummary}</p>}
                      {item.status === "ERROR" && item.lastError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{item.lastError}</p>}
                    </div>
                    <span className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${STATUS_STYLE[item.status]}`}>
                      <Icon size={12} />
                      {item.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    {item.managedBy === "google-oauth" && item.manageHref && (
                      <Link href={item.manageHref} className="text-xs text-brand-orange-deep dark:text-brand-orange-light hover:underline">
                        Manage on SEO page
                      </Link>
                    )}
                    {item.managedBy === "env" && <span className="text-xs text-caption italic">Managed via environment variables</span>}
                    {item.managedBy === "hub" && item.provider && (
                      <>
                        {item.status === "DISCONNECTED" ? (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            className="flex items-center gap-1 text-xs text-brand-orange-deep dark:text-brand-orange-light hover:underline"
                          >
                            Connect {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        ) : (
                          <>
                            {item.liveTestAvailable && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleTest(item.provider!)}
                                className="flex items-center gap-1 text-xs text-caption hover:text-brand-orange-deep dark:hover:text-brand-orange-light disabled:opacity-50"
                              >
                                {isBusy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                Reconnect
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : item.id)}
                              className="text-xs text-caption hover:text-foreground"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDisconnect(item.provider!)}
                              className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                            >
                              Disconnect
                            </button>
                          </>
                        )}
                        {!item.liveTestAvailable && item.status === "CONNECTED" && (
                          <span className="text-xs text-caption italic">Not independently verified</span>
                        )}
                      </>
                    )}
                  </div>

                  {isExpanded && fieldDef && (
                    <ConnectForm
                      fieldDef={fieldDef}
                      initialValues={{}}
                      onSave={(credentials) => handleSave(item.provider!, credentials)}
                      onCancel={() => setExpandedId(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
