import { getSiteSettings } from "../../actions/settings";
import { getNapConsistency } from "../../actions/seo-audit";
import SettingsForm from "@/components/Admin/SettingsForm";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export default async function SettingsPage() {
  const settings = await getSiteSettings();
  const nap = await getNapConsistency();

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
    </div>
  );
}
