import { fetchGA4Traffic, fetchGSCClicks } from "@/lib/seo-services";
import { getSeoAudit } from "@/app/(admin)/actions/seo-audit";
import { getGoogleIntegration } from "@/app/(admin)/actions/google";
import { prisma } from "@/lib/prisma";
import BrokenLinkChecker from "@/components/Admin/BrokenLinkChecker";
import GoogleIntegrationPanel from "@/components/Admin/GoogleIntegrationPanel";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export default async function SEODashboard({
  searchParams,
}: {
  searchParams: Promise<{ google_connected?: string; google_error?: string }>;
}) {
  const { google_connected, google_error } = await searchParams;

  const integration = await getGoogleIntegration();
  // Real API calls, only attempted once the admin has connected + configured a property/site.
  const trafficData = await fetchGA4Traffic();
  const clicksData = await fetchGSCClicks();

  // Fetch 404 logs
  const notFoundLogs = await prisma.notFoundLog.findMany({
    orderBy: { count: 'desc' },
    take: 10,
  });

  const audit = await getSeoAudit();
  const scoreColor = audit.healthScore >= 80 ? "text-green-600 dark:text-green-400" : audit.healthScore >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";

  const maxDailySessions = Math.max(1, ...(trafficData?.dailySessions.map((d) => d.sessions) || [1]));

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SEO & Analytics Dashboard</h1>
      </div>

      <GoogleIntegrationPanel
        integration={integration}
        googleError={google_error}
        justConnected={google_connected === "1"}
      />

      {/* SEO Health Score */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Site-Wide SEO Health Score</h2>
          <span className={`text-3xl font-bold ${scoreColor}`}>{audit.healthScore}/100</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Based on {audit.totalItems} published items: meta title/description/focus keyword coverage and duplicate detection.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center gap-2">
              {audit.missingMetaTitle.length === 0 ? <CheckCircle2 size={16} className="text-green-500" /> : <AlertTriangle size={16} className="text-yellow-500" />}
              <span className="font-medium text-gray-900 dark:text-white">{audit.missingMetaTitle.length} missing meta title{audit.missingMetaTitle.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center gap-2">
              {audit.missingMetaDescription.length === 0 ? <CheckCircle2 size={16} className="text-green-500" /> : <AlertTriangle size={16} className="text-yellow-500" />}
              <span className="font-medium text-gray-900 dark:text-white">{audit.missingMetaDescription.length} missing meta description{audit.missingMetaDescription.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center gap-2">
              {audit.missingFocusKeyword.length === 0 ? <CheckCircle2 size={16} className="text-green-500" /> : <AlertTriangle size={16} className="text-yellow-500" />}
              <span className="font-medium text-gray-900 dark:text-white">{audit.missingFocusKeyword.length} missing focus keyword{audit.missingFocusKeyword.length === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Duplicate detection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Duplicate Meta Titles</h2>
          {audit.duplicateMetaTitles.length === 0 ? (
            <p className="text-sm text-green-600 dark:text-green-400">No duplicates found.</p>
          ) : (
            <div className="space-y-3">
              {audit.duplicateMetaTitles.map((dup) => (
                <div key={dup.value} className="text-sm">
                  <p className="font-medium text-gray-900 dark:text-white">"{dup.value}"</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">
                    Used by: {dup.items.map((i) => i.path).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Duplicate Meta Descriptions</h2>
          {audit.duplicateMetaDescriptions.length === 0 ? (
            <p className="text-sm text-green-600 dark:text-green-400">No duplicates found.</p>
          ) : (
            <div className="space-y-3">
              {audit.duplicateMetaDescriptions.map((dup) => (
                <div key={dup.value} className="text-sm">
                  <p className="font-medium text-gray-900 dark:text-white line-clamp-1">"{dup.value}"</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">
                    Used by: {dup.items.map((i) => i.path).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Keyword-to-Page Mapping Conflicts</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Two or more pages targeting the same focus keyword compete against each other in search results.
          </p>
          {audit.duplicateKeywords.length === 0 ? (
            <p className="text-sm text-green-600 dark:text-green-400">No conflicting keyword targets found.</p>
          ) : (
            <div className="space-y-3">
              {audit.duplicateKeywords.map((dup) => (
                <div key={dup.value} className="text-sm">
                  <p className="font-medium text-gray-900 dark:text-white">"{dup.value}"</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">
                    Targeted by: {dup.items.map((i) => i.path).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BrokenLinkChecker />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GA4 / Traffic Card */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Traffic Overview (GA4, last 30 days)</h2>
          {trafficData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Sessions</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{trafficData.sessions.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Active Users</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{trafficData.activeUsers.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">Page Views</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{trafficData.pageViews.toLocaleString()}</p>
                </div>
              </div>
              {trafficData.dailySessions.length > 0 && (
                <div className="flex items-end gap-0.5 h-20">
                  {trafficData.dailySessions.map((d) => (
                    <div
                      key={d.date}
                      title={`${d.date}: ${d.sessions} sessions`}
                      className="flex-1 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"
                      style={{ height: `${Math.max(4, (d.sessions / maxDailySessions) * 100)}%` }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center bg-gray-50 dark:bg-gray-900/50 rounded border border-dashed border-gray-300 dark:border-gray-700">
              <p className="text-gray-500 text-sm text-center px-4">
                {integration ? "Add your GA4 Property ID above to see traffic data." : "Connect Google above to see traffic data."}
              </p>
            </div>
          )}
        </div>

        {/* GSC / Clicks Card */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Search Console (30d)</h2>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Clicks</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{clicksData ? clicksData.clicks.toLocaleString() : "--"}</p>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Avg. Position</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{clicksData ? clicksData.position.toFixed(1) : "--"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 404 Logs */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">404 Error Logs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-3 font-medium text-gray-500">Path</th>
                  <th className="pb-3 font-medium text-gray-500">Hits</th>
                  <th className="pb-3 font-medium text-gray-500">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {notFoundLogs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-500">
                      No 404 errors logged yet.
                    </td>
                  </tr>
                ) : (
                  notFoundLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-3 text-gray-900 dark:text-white truncate max-w-[200px]">{log.path}</td>
                      <td className="py-3 text-gray-600 dark:text-gray-300">{log.count}</td>
                      <td className="py-3 text-gray-500 text-xs">{new Date(log.updatedAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rank Tracking */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Keyword Rankings</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            See the <a href="/admin/keywords" className="text-blue-600 dark:text-blue-400 hover:underline">Keyword Tracking</a> page for rank position history and competitor comparison.
          </p>
        </div>
      </div>
    </div>
  );
}
