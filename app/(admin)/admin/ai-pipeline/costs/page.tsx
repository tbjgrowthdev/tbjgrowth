import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getCostSummaryAction } from "@/app/(admin)/actions/content-pipeline";

const CONTENT_TYPE_LABEL: Record<string, string> = {
  POST: "Blog Posts",
  CASE_STUDY: "Case Studies",
  UNKNOWN: "Unattributed",
};

function formatUsd(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

export default async function AiCostDashboardPage() {
  const summary = await getCostSummaryAction();

  if (!summary) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">AI Cost Tracking</h1>
        <p className="text-caption">You don&apos;t have permission to view this.</p>
      </div>
    );
  }

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const thisMonthCost = summary.monthlyCost.find((m) => m.month === currentMonthKey)?.cost ?? 0;
  const maxDaily = Math.max(0.0001, ...summary.dailyCost.map((d) => d.cost));
  const maxMonthly = Math.max(0.0001, ...summary.monthlyCost.map((m) => m.cost));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/ai-pipeline" className="text-sm text-caption hover:text-foreground">
          ← AI Content Pipeline
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-1">AI Cost Tracking</h1>
        <p className="text-caption">
          Estimated spend, computed from recorded token usage against{" "}
          <code className="text-xs bg-tint px-1 py-0.5 rounded">lib/content-pipeline/pricing.ts</code> — verify those rates against each provider&apos;s
          current pricing before treating these numbers as exact.
        </p>
      </div>

      {summary.unknownCostJobCount > 0 && (
        <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {summary.unknownCostJobCount} job{summary.unknownCostJobCount === 1 ? "" : "s"} recorded token usage for a model with no listed price and
            {summary.unknownCostJobCount === 1 ? " is" : " are"} excluded from every total below — add that model to <code>pricing.ts</code> to include it.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard label="This month" value={formatUsd(thisMonthCost)} />
        <SummaryCard label="Total (all recorded)" value={formatUsd(summary.totalCost)} />
        <SummaryCard label="Total tokens" value={summary.totalTokens.toLocaleString()} />
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Daily cost (last 30 days)</h2>
        {summary.dailyCost.length > 0 ? (
          <div className="flex items-end gap-0.5 h-24">
            {summary.dailyCost.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${formatUsd(d.cost)}`}
                className="flex-1 bg-gradient-to-t from-brand-orange-deep to-brand-orange-light rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"
                style={{ height: `${Math.max(4, (d.cost / maxDaily) * 100)}%` }}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-caption">No priced jobs yet.</p>
        )}
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Monthly cost (last 12 months)</h2>
        {summary.monthlyCost.length > 0 ? (
          <div className="flex items-end gap-1 h-24">
            {summary.monthlyCost.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <div
                  title={`${m.month}: ${formatUsd(m.cost)}`}
                  className="w-full bg-gradient-to-t from-brand-orange-deep to-brand-orange-light rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"
                  style={{ height: `${Math.max(4, (m.cost / maxMonthly) * 80)}px` }}
                />
                <span className="text-[10px] text-caption">{m.month.slice(5)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-caption">No priced jobs yet.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <h2 className="text-lg font-semibold text-foreground p-6 pb-4">Cost by model</h2>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-background border-y border-border">
                <th className="px-6 py-2 font-medium text-caption">Model</th>
                <th className="px-6 py-2 font-medium text-caption">Jobs</th>
                <th className="px-6 py-2 font-medium text-caption">Tokens</th>
                <th className="px-6 py-2 font-medium text-caption">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.costByModel.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-6 text-center text-caption">
                    No priced jobs yet.
                  </td>
                </tr>
              ) : (
                summary.costByModel.map((m) => (
                  <tr key={`${m.provider}:${m.model}`}>
                    <td className="px-6 py-3 text-foreground">
                      {m.provider} / {m.model}
                    </td>
                    <td className="px-6 py-3 text-caption">{m.jobCount}</td>
                    <td className="px-6 py-3 text-caption">{m.tokens.toLocaleString()}</td>
                    <td className="px-6 py-3 text-foreground font-medium">{formatUsd(m.cost)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <h2 className="text-lg font-semibold text-foreground p-6 pb-4">Cost by content type</h2>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-background border-y border-border">
                <th className="px-6 py-2 font-medium text-caption">Content type</th>
                <th className="px-6 py-2 font-medium text-caption">Jobs</th>
                <th className="px-6 py-2 font-medium text-caption">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.costByContentType.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-6 text-center text-caption">
                    No priced jobs yet.
                  </td>
                </tr>
              ) : (
                summary.costByContentType.map((c) => (
                  <tr key={c.contentType}>
                    <td className="px-6 py-3 text-foreground">{CONTENT_TYPE_LABEL[c.contentType] ?? c.contentType}</td>
                    <td className="px-6 py-3 text-caption">{c.jobCount}</td>
                    <td className="px-6 py-3 text-foreground font-medium">{formatUsd(c.cost)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-5">
      <p className="text-xs text-caption font-medium">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}
