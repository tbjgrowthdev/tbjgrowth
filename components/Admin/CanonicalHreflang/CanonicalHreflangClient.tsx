"use client";

import { useState } from "react";
import { Loader2, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";
import { getCanonicalHreflangReport } from "@/app/(admin)/actions/canonical-hreflang";
import type { CanonicalContentType, CanonicalIssue, HreflangIssue } from "@/lib/canonical-hreflang";

type Result = Awaited<ReturnType<typeof getCanonicalHreflangReport>>;

const CONTENT_LABEL: Record<CanonicalContentType, string> = {
  POST: "Blog Post",
  CASE_STUDY: "Case Study",
  PAGE: "Page",
  SERVICE: "Service",
};

const ADMIN_EDIT_PATH: Record<CanonicalContentType, string> = {
  POST: "/admin/posts",
  CASE_STUDY: "/admin/cases",
  PAGE: "/admin/pages",
  SERVICE: "/admin/services",
};

const CANONICAL_KIND_LABEL: Record<CanonicalIssue["kind"], string> = {
  malformed: "Malformed URL",
  "cross-domain": "Cross-Domain",
  "duplicate-target": "Duplicate Target",
};

const CANONICAL_KIND_STYLE: Record<CanonicalIssue["kind"], string> = {
  malformed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "cross-domain": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "duplicate-target": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function IssueRow({ contentType, contentId, title, path, badge, badgeStyle, detail }: {
  contentType: CanonicalContentType;
  contentId: string;
  title: string;
  path: string;
  badge: string;
  badgeStyle: string;
  detail: string;
}) {
  return (
    <div className="px-6 py-4 flex items-start gap-4">
      <span className={`shrink-0 px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${badgeStyle}`}>{badge}</span>
      <div className="flex-1 min-w-0">
        <a
          href={`${ADMIN_EDIT_PATH[contentType]}/${contentId}`}
          className="font-medium text-foreground hover:text-brand-orange-deep dark:hover:text-brand-orange-light inline-flex items-center gap-1"
        >
          {title}
          <ExternalLink size={12} />
        </a>
        <span className="block text-xs text-caption">{CONTENT_LABEL[contentType]} · {path}</span>
        <p className="text-sm text-caption mt-1">{detail}</p>
      </div>
    </div>
  );
}

export default function CanonicalHreflangClient({ initialResult }: { initialResult: Result }) {
  const [result, setResult] = useState(initialResult);
  const [scanning, setScanning] = useState(false);

  const scan = async () => {
    setScanning(true);
    const next = await getCanonicalHreflangReport();
    setResult(next);
    setScanning(false);
  };

  if (!result.success) {
    return <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>;
  }

  const { canonicalIssues, hreflangIssues, scannedCount, scannedAt } = result.data;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Canonical &amp; Hreflang</h1>
          <p className="text-caption">
            Every published Post, Page, Case Study, and indexable Service gets an auto-generated canonical URL
            (its own URL) unless overridden in its SEO panel, plus hreflang alternates for any published translation.
            This audits both: malformed or cross-domain canonical overrides, duplicate canonical targets across
            different content, and hreflang/canonical combinations that send search engines a contradictory signal.
          </p>
        </div>
        <button
          type="button"
          disabled={scanning}
          onClick={scan}
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 whitespace-nowrap"
        >
          {scanning ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          Scan Now
        </button>
      </div>

      <p className="text-xs text-caption">
        Last scanned {new Date(scannedAt).toLocaleString()} · {scannedCount} item(s) checked
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Canonical issues ({canonicalIssues.length})</h2>
        <div className="bg-card rounded-lg shadow-sm border border-border divide-y divide-border overflow-hidden">
          {canonicalIssues.length === 0 ? (
            <p className="px-6 py-8 text-center text-caption">No canonical issues found.</p>
          ) : (
            canonicalIssues.map((issue, i) => (
              <IssueRow
                key={`${issue.contentType}-${issue.contentId}-${issue.kind}-${i}`}
                contentType={issue.contentType}
                contentId={issue.contentId}
                title={issue.title}
                path={issue.path}
                badge={CANONICAL_KIND_LABEL[issue.kind]}
                badgeStyle={CANONICAL_KIND_STYLE[issue.kind]}
                detail={
                  issue.relatedItems && issue.relatedItems.length > 0
                    ? `${issue.detail} Also: ${issue.relatedItems.map((r) => r.title).join(", ")}.`
                    : issue.detail
                }
              />
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500" />
          Hreflang reciprocal validation issues ({hreflangIssues.length})
        </h2>
        <div className="bg-card rounded-lg shadow-sm border border-border divide-y divide-border overflow-hidden">
          {hreflangIssues.length === 0 ? (
            <p className="px-6 py-8 text-center text-caption">No reciprocal hreflang issues found.</p>
          ) : (
            hreflangIssues.map((issue: HreflangIssue, i) => (
              <IssueRow
                key={`${issue.contentType}-${issue.contentId}-${i}`}
                contentType={issue.contentType}
                contentId={issue.contentId}
                title={issue.title}
                path={issue.path}
                badge="Non-Reciprocal"
                badgeStyle="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                detail={issue.detail}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
