import prisma from "@/lib/prisma";
import { getWebVitalsSummary, getRecentFailedLogins } from "@/app/(admin)/actions/technical";
import SslChecker from "@/components/Admin/SslChecker";
import { FileText, FileEdit, Users, ShieldAlert, Database, Activity } from "lucide-react";

const METRIC_LABELS: Record<string, string> = {
  LCP: "Largest Contentful Paint",
  CLS: "Cumulative Layout Shift",
  INP: "Interaction to Next Paint",
  FCP: "First Contentful Paint",
  TTFB: "Time to First Byte",
};

const RATING_COLOR: Record<string, string> = {
  good: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20",
  "needs-improvement": "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20",
  poor: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20",
};

function formatMetricValue(metric: string, value: number) {
  if (metric === "CLS") return value.toFixed(3);
  return `${Math.round(value)}ms`;
}

export default async function AdminDashboard() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [pageCount, publishedPostCount, newLeadsCount, vitals, failedLogins] = await Promise.all([
    prisma.page.count(),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.formSubmission.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    getWebVitalsSummary(),
    getRecentFailedLogins(24),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
            <FileText className="text-blue-600 dark:text-blue-400" size={22} />
          </div>
          <div>
            <h3 className="text-gray-500 text-sm font-medium">Total Pages</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{pageCount}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20">
            <FileEdit className="text-purple-600 dark:text-purple-400" size={22} />
          </div>
          <div>
            <h3 className="text-gray-500 text-sm font-medium">Published Posts</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{publishedPostCount}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20">
            <Users className="text-green-600 dark:text-green-400" size={22} />
          </div>
          <div>
            <h3 className="text-gray-500 text-sm font-medium">New Leads (30d)</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{newLeadsCount}</p>
          </div>
        </div>
      </div>

      {/* Core Web Vitals */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity size={18} />
            Core Web Vitals (p75, last 7 days)
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">{vitals.totalSamples} real visitor samples</span>
        </div>
        {vitals.metrics.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No visitor data collected yet. Metrics populate automatically as people browse the live site.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {vitals.metrics.map((m) => (
              <div key={m.metric} className={`p-3 rounded-lg ${RATING_COLOR[m.rating] || "bg-gray-50 dark:bg-gray-900/50"}`}>
                <p className="text-xs font-medium opacity-80" title={METRIC_LABELS[m.metric]}>{m.metric}</p>
                <p className="text-lg font-bold">{formatMetricValue(m.metric, m.p75)}</p>
                <p className="text-[10px] opacity-70 capitalize">{m.rating.replace("-", " ")}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Technical Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SslChecker />

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Database size={16} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Database Backups</h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Backups are managed by Neon (your Postgres host), which takes continuous point-in-time-recovery snapshots automatically. No action needed here — manage retention in your Neon project dashboard.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={16} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Failed Logins (24h)</h3>
          </div>
          {failedLogins.length === 0 ? (
            <p className="text-xs text-green-600 dark:text-green-400">No failed login attempts.</p>
          ) : (
            <ul className="space-y-1 max-h-24 overflow-y-auto">
              {failedLogins.slice(0, 5).map((a) => (
                <li key={a.id} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {a.email} — {new Date(a.createdAt).toLocaleTimeString()}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
