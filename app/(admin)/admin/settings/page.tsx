import { getSiteSettings } from "../../actions/settings";
import { getNapConsistency } from "../../actions/seo-audit";
import { getAiProviderSettings } from "../../actions/ai-settings";
import { getCurrentAdmin } from "../../actions/profile";
import SettingsForm from "@/components/Admin/SettingsForm";
import AiProviderSettings from "@/components/Admin/AiProviderSettings";
import { hasPermission } from "@/lib/permissions";
import { PROVIDER_LABEL, resolveAiConfig } from "@/lib/content-pipeline/providers/config";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export default async function SettingsPage() {
  const settings = await getSiteSettings();
  const nap = await getNapConsistency();
  const currentAdmin = await getCurrentAdmin();
  const canManageAi = hasPermission(currentAdmin?.role, "INTEGRATION_MANAGEMENT");
  const aiSettings = canManageAi ? await getAiProviderSettings() : null;
  const aiActive = canManageAi ? null : await resolveAiConfig();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Global Site Settings</h1>

      {nap.checked && (
        <div className={`p-4 rounded-lg flex items-start gap-3 text-sm ${nap.issues.length === 0 ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400"}`}>
          {nap.issues.length === 0 ? <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />}
          <div>
            <p className="font-medium">
              {nap.issues.length === 0 ? "NAP consistency check passed" : "NAP consistency issues found"}
            </p>
            {nap.issues.length > 0 && (
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                {nap.issues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            )}
            <p className="mt-1 text-xs opacity-80">
              Your Name/Address/Phone must match exactly across this site and your Google Business Profile for local SEO — inconsistencies hurt local rankings.
            </p>
          </div>
        </div>
      )}

      {settings && <SettingsForm initialData={settings} />}

      {aiSettings?.success && <AiProviderSettings initial={aiSettings.data} />}
      {aiSettings && !aiSettings.success && (
        <div id="ai-provider" className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg text-sm">
          <p className="font-medium">AI Provider</p>
          <p>{aiSettings.error}</p>
        </div>
      )}
      {aiActive && (
        <div id="ai-provider" className="bg-card p-6 rounded-xl shadow-sm border border-border text-sm">
          <h2 className="text-xl font-bold text-foreground mb-2">AI Provider</h2>
          <p className="text-muted">
            Text: <strong>{PROVIDER_LABEL[aiActive.text.provider] ?? aiActive.text.provider}</strong> · Images:{" "}
            <strong>{PROVIDER_LABEL[aiActive.image.provider] ?? aiActive.image.provider}</strong>
          </p>
          <p className="text-xs text-caption mt-1">Only a Super Admin can change the AI provider.</p>
        </div>
      )}
    </div>
  );
}
