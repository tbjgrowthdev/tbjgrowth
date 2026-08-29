"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { disconnectGoogle, updateGoogleConfig } from "@/app/(admin)/actions/google";
import { CheckCircle2, AlertCircle, LogOut } from "lucide-react";

type Integration = {
  connectedEmail: string | null;
  ga4PropertyId: string | null;
  gscSiteUrl: string | null;
} | null;

export default function GoogleIntegrationPanel({
  integration,
  googleError,
  justConnected,
}: {
  integration: Integration;
  googleError?: string;
  justConnected?: boolean;
}) {
  const router = useRouter();
  const [ga4PropertyId, setGa4PropertyId] = useState(integration?.ga4PropertyId || "");
  const [gscSiteUrl, setGscSiteUrl] = useState(integration?.gscSiteUrl || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMsg(null);
    const result = await updateGoogleConfig({ ga4PropertyId, gscSiteUrl });
    setSaveMsg(result.success ? "Saved." : result.error || "Failed to save");
    router.refresh();
    setIsSaving(false);
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Google Analytics & Search Console? You'll need to reconnect to see live data again.")) return;
    setIsDisconnecting(true);
    await disconnectGoogle();
    router.refresh();
    setIsDisconnecting(false);
  };

  if (!integration) {
    return (
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-2">Connect Google Analytics & Search Console</h2>
        <p className="text-sm text-caption mb-4">
          Connect your Google account to pull live GA4 traffic and Search Console performance data into this dashboard.
        </p>
        {googleError && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mb-4">
            <AlertCircle size={16} />
            {googleError === "no_refresh_token"
              ? "Google didn't return a refresh token — if you've connected before, revoke access at myaccount.google.com/permissions and try again."
              : `Connection failed (${googleError}). Please try again.`}
          </div>
        )}
        <a
          href="/api/google/connect"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white text-sm font-medium rounded-lg hover:bg-brand-orange transition-colors"
        >
          Connect Google Account
        </a>
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-green-500" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Connected {integration.connectedEmail ? `as ${integration.connectedEmail}` : ""}
            </p>
            {justConnected && <p className="text-xs text-green-600 dark:text-green-400">Connected successfully.</p>}
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
        >
          <LogOut size={14} />
          {isDisconnecting ? "Disconnecting..." : "Disconnect"}
        </button>
      </div>

      <form onSubmit={handleSaveConfig} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-caption">GA4 Property ID</label>
          <input
            type="text"
            value={ga4PropertyId}
            onChange={(e) => setGa4PropertyId(e.target.value)}
            placeholder="e.g. 123456789"
            className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-transparent"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-caption">GSC Verified Site URL</label>
          <input
            type="text"
            value={gscSiteUrl}
            onChange={(e) => setGscSiteUrl(e.target.value)}
            placeholder="https://tbjgrowth.com/"
            className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-transparent"
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="px-3 py-1.5 bg-brand-orange-deep text-white text-xs font-medium rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          {saveMsg && <span className="text-xs text-caption">{saveMsg}</span>}
        </div>
      </form>
    </div>
  );
}
