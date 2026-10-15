"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Circle, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import {
  advanceDraftAction,
  advanceInternalLinksAction,
  advanceOutlineAction,
  advanceQaAction,
  advanceResearchAction,
  advanceSchemaAction,
  advanceSearchIntentAction,
  advanceSeoAction,
  approveRunAction,
  publishRunAction,
  getPipelineRunAction,
  getJobsForRunAction,
} from "@/app/(admin)/actions/content-pipeline";
import { PIPELINE_STAGE_ORDER, STAGE_LABEL, nextStage } from "@/lib/content-pipeline/types";
import type { Brief, Research, SearchIntent, Outline, QaReport, AppliedInternalLink } from "@/lib/content-pipeline/types";

type RunAndContent = NonNullable<Awaited<ReturnType<typeof getPipelineRunAction>>> & { jobs: Awaited<ReturnType<typeof getJobsForRunAction>> };

function parse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

const STAGE_ACTIONS: Record<string, (runId: string) => Promise<{ success: boolean; error?: string }>> = {
  SEARCH_INTENT: advanceSearchIntentAction,
  RESEARCH: advanceResearchAction,
  OUTLINE: advanceOutlineAction,
  DRAFT: advanceDraftAction,
  SEO: advanceSeoAction,
  INTERNAL_LINKS: advanceInternalLinksAction,
  SCHEMA: advanceSchemaAction,
  QA: advanceQaAction,
};

export default function PipelineWizard({ run, content, jobs }: RunAndContent) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brief = parse<Brief>(run.brief);
  const searchIntent = parse<SearchIntent>(run.searchIntent);
  const research = parse<Research>(run.research);
  const outline = parse<Outline>(run.outline);
  const internalLinks = parse<AppliedInternalLink[]>(run.internalLinks);
  const qaReport = parse<QaReport>(run.qaReport);

  const upcoming = nextStage(run.stage);
  const currentIndex = PIPELINE_STAGE_ORDER.indexOf(run.stage);
  const pendingJob = upcoming ? jobs.find((j) => j.stage === upcoming) : undefined;

  const runStage = async (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    const result = await fn();
    setBusy(false);
    if (!result.success) {
      setError(result.error || "Something went wrong");
      return;
    }
    router.refresh();
  };

  const editorHref = run.contentId ? (run.contentType === "POST" ? `/admin/posts/${run.contentId}` : `/admin/cases/${run.contentId}`) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{brief?.topic || "AI Content Pipeline Run"}</h1>
          <p className="text-caption">{run.contentType === "CASE_STUDY" ? "Case Study" : "Blog Post"}</p>
        </div>
        {editorHref && (
          <Link href={editorHref} target="_blank" className="flex items-center gap-1.5 text-sm text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light shrink-0">
            Open in full editor <ExternalLink size={14} />
          </Link>
        )}
      </div>

      <Stepper currentIndex={currentIndex} />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {brief && <StageCard title="Brief" done>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Dl label="Goal" value={brief.goal} />
          <Dl label="Audience" value={brief.audience} />
          <Dl label="Tone" value={brief.tone} />
          {brief.notes && <Dl label="Notes" value={brief.notes} />}
          {run.contentType === "CASE_STUDY" && (
            <>
              <Dl label="Client" value={brief.clientName} />
              <Dl label="Industry" value={brief.industry} />
              <Dl label="Service" value={brief.serviceType} />
            </>
          )}
        </dl>
      </StageCard>}

      {searchIntent && (
        <StageCard title="Search Intent" done>
          <p className="text-sm text-caption mb-3">{searchIntent.rationale}</p>
          <div className="text-sm"><span className="font-medium text-foreground">Intent:</span> {searchIntent.intentType}</div>
          <div className="mt-3">
            <div className="font-medium text-sm text-foreground mb-1">Primary keyword</div>
            <KeywordChip keyword={searchIntent.primaryKeyword} highlight />
            <div className="font-medium text-sm text-foreground mt-3 mb-1">Secondary keywords</div>
            <div className="flex flex-wrap gap-2">
              {searchIntent.secondaryKeywords.map((k) => (
                <KeywordChip key={k.keyword} keyword={k.keyword} volume={k.searchVolume} />
              ))}
            </div>
          </div>
        </StageCard>
      )}

      {research && (
        <StageCard title="Research" done>
          <ListBlock label="Common themes already covered" items={research.commonThemes} />
          <ListBlock label="Content gaps this piece can fill" items={research.contentGaps} />
          <ListBlock label="Questions to answer" items={research.questionsToAnswer} />
          {research.retrievedSources.length > 0 && (
            <div className="mb-3">
              <div className="text-sm font-medium text-foreground mb-1">Approved internal sources retrieved (RAG)</div>
              <ul className="space-y-1 text-sm">
                {research.retrievedSources.map((s, i) => (
                  <li key={i} className="text-caption">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-tint text-brand-orange-deep dark:text-brand-orange-light mr-1.5">{s.sourceType}</span>
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-brand-orange-deep dark:hover:text-brand-orange-light">
                        {s.title}
                      </a>
                    ) : (
                      <span className="text-foreground">{s.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </StageCard>
      )}

      {outline && (
        <StageCard title="Outline" done>
          <p className="text-sm font-medium text-foreground mb-3">{outline.title}</p>
          <div className="space-y-3">
            {outline.sections.map((s, i) => (
              <div key={i} className={s.level === "h3" ? "pl-4" : ""}>
                <div className="text-sm font-medium text-foreground">{s.heading}</div>
                <p className="text-xs text-caption">{s.summary}</p>
              </div>
            ))}
          </div>
        </StageCard>
      )}

      {content && run.stage !== "BRIEF" && run.stage !== "SEARCH_INTENT" && run.stage !== "RESEARCH" && run.stage !== "OUTLINE" && (
        <StageCard title="Draft" done>
          <p className="text-sm font-medium text-foreground mb-2">{content.title}</p>
          <div className="prose prose-sm max-w-none text-sm text-caption max-h-64 overflow-y-auto scrollbar-thin border border-border rounded-md p-4" dangerouslySetInnerHTML={{ __html: content.content }} />
        </StageCard>
      )}

      {content?.metaTitle && (
        <StageCard title="SEO" done>
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <Dl label="Meta title" value={`${content.metaTitle} (${content.metaTitle.length} chars)`} />
            <Dl label="Meta description" value={`${content.metaDescription} (${content.metaDescription?.length ?? 0} chars)`} />
          </dl>
        </StageCard>
      )}

      {internalLinks && (
        <StageCard title="Internal Links" done>
          {internalLinks.length === 0 ? (
            <p className="text-sm text-caption">No internal links were applied.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {internalLinks.map((l, i) => (
                <li key={i} className="flex items-center gap-2">
                  {l.applied ? <CheckCircle2 size={14} className="text-green-600 shrink-0" /> : <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
                  <span className="text-foreground">&ldquo;{l.anchorText}&rdquo;</span>
                  <span className="text-caption">→ {l.targetUrl}</span>
                  {!l.applied && <span className="text-xs text-caption">({l.reason})</span>}
                </li>
              ))}
            </ul>
          )}
        </StageCard>
      )}

      {content?.schemaJson && (
        <StageCard title="Schema" done>
          <pre className="text-xs bg-background border border-border rounded-md p-3 overflow-x-auto max-h-48 overflow-y-auto scrollbar-thin">
            {JSON.stringify(JSON.parse(content.schemaJson), null, 2)}
          </pre>
        </StageCard>
      )}

      {qaReport && (
        <StageCard title="QA" done>
          <p className="text-sm text-caption mb-3">{qaReport.summary} — {qaReport.wordCount} words.</p>
          <ul className="space-y-1.5 text-sm">
            {qaReport.checks.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                {c.passed ? <CheckCircle2 size={14} className="text-green-600 mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />}
                <span>
                  <span className="text-foreground">{c.label}</span>
                  {c.note && <span className="text-caption"> — {c.note}</span>}
                </span>
              </li>
            ))}
          </ul>
          {!qaReport.overallPassed && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
              One or more checks didn&apos;t pass — review the notes above before approving. This doesn&apos;t block approval; it&apos;s your call.
            </p>
          )}
        </StageCard>
      )}

      {run.stage === "APPROVAL" && (
        <StageCard title="Human Approval" done>
          <p className="text-sm text-caption">Approved — ready to publish below.</p>
        </StageCard>
      )}

      {/* Action area for whatever comes next */}
      {upcoming && upcoming !== "PUBLISHED" && run.stage !== "APPROVAL" && STAGE_ACTIONS[upcoming] && (
        <>
          {pendingJob?.status === "FAILED" && pendingJob.error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">
              <AlertTriangle size={16} />
              <span>
                {STAGE_LABEL[upcoming]} failed{pendingJob.retryCount > 0 ? ` (retried ${pendingJob.retryCount}×)` : ""}: {pendingJob.error}
              </span>
            </div>
          )}
          <ActionBar
            busy={busy}
            label={pendingJob?.status === "FAILED" ? `Retry ${STAGE_LABEL[upcoming]}` : `Generate ${STAGE_LABEL[upcoming]}`}
            onClick={() => runStage(() => STAGE_ACTIONS[upcoming](run.id))}
          />
        </>
      )}

      {run.stage === "QA" && (
        <ActionBar busy={busy} label="Approve for publish" onClick={() => runStage(() => approveRunAction(run.id))} />
      )}

      {run.stage === "APPROVAL" && <PublishPanel runId={run.id} busy={busy} setBusy={setBusy} setError={setError} onDone={() => router.refresh()} />}

      {run.stage === "PUBLISHED" && (
        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-3">
          <CheckCircle2 size={16} />
          Done. {editorHref && <Link href={editorHref} className="underline">View the content</Link>}
        </div>
      )}

      {jobs.length > 0 && <JobLog jobs={jobs} />}
    </div>
  );
}

function Stepper({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-thin">
      {PIPELINE_STAGE_ORDER.map((stage, i) => (
        <div key={stage} className="flex items-center gap-1 shrink-0">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${i <= currentIndex ? "bg-brand-orange-deep text-white" : "bg-tint text-caption"}`}>
            {i <= currentIndex ? <CheckCircle2 size={12} /> : <Circle size={12} />}
            {STAGE_LABEL[stage]}
          </div>
          {i < PIPELINE_STAGE_ORDER.length - 1 && <div className={`w-4 h-px ${i < currentIndex ? "bg-brand-orange-deep" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

function StageCard({ title, done, children }: { title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        {done && <CheckCircle2 size={16} className="text-green-600" />}
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function JobLog({ jobs }: { jobs: RunAndContent["jobs"] }) {
  return (
    <details className="bg-card rounded-lg shadow-sm border border-border p-5">
      <summary className="font-semibold text-foreground cursor-pointer">Job Log ({jobs.length})</summary>
      <table className="w-full text-left border-collapse text-sm mt-3">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 pr-3 font-medium text-caption">Stage</th>
            <th className="py-2 pr-3 font-medium text-caption">Model</th>
            <th className="py-2 pr-3 font-medium text-caption">Status</th>
            <th className="py-2 pr-3 font-medium text-caption">Retries</th>
            <th className="py-2 pr-3 font-medium text-caption">Tokens</th>
            <th className="py-2 pr-3 font-medium text-caption">Cost</th>
            <th className="py-2 pr-3 font-medium text-caption">Error</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {jobs.map((job) => (
            <tr key={job.id}>
              <td className="py-2 pr-3 text-foreground">{STAGE_LABEL[job.stage]}</td>
              <td className="py-2 pr-3 text-caption">{job.model}</td>
              <td className="py-2 pr-3 text-caption">{job.status}</td>
              <td className="py-2 pr-3 text-caption">{job.retryCount}</td>
              <td className="py-2 pr-3 text-caption">{job.totalTokens?.toLocaleString() ?? "—"}</td>
              <td className="py-2 pr-3 text-caption">
                {job.costUsd != null ? `$${job.costUsd.toFixed(job.costUsd < 1 ? 4 : 2)}` : job.totalTokens != null ? "unpriced" : "—"}
              </td>
              <td className="py-2 pr-3 text-caption max-w-xs truncate" title={job.error || ""}>
                {job.error || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function ActionBar({ busy, label, onClick }: { busy: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="flex items-center gap-2 px-5 py-3 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm font-medium w-full justify-center"
    >
      {busy && <Loader2 size={16} className="animate-spin" />}
      {label}
    </button>
  );
}

function Dl({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-caption">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="text-sm font-medium text-foreground mb-1">{label}</div>
      <ul className="list-disc list-inside text-sm text-caption space-y-0.5">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function KeywordChip({ keyword, volume, highlight }: { keyword: string; volume?: number | null; highlight?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border mr-2 mb-1 ${highlight ? "bg-brand-orange-deep text-white border-brand-orange-deep" : "border-border text-caption"}`}>
      {keyword}
      {typeof volume === "number" && <span className="opacity-70">· {volume}/mo</span>}
    </span>
  );
}

function PublishPanel({
  runId,
  busy,
  setBusy,
  setError,
  onDone,
}: {
  runId: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [showSchedule, setShowSchedule] = useState(false);

  const act = async (mode: "publish" | "submit" | "schedule") => {
    setBusy(true);
    setError(null);
    const result = await publishRunAction(runId, mode, mode === "schedule" ? { date, time, timezone } : undefined);
    setBusy(false);
    if (!result.success) {
      setError(result.error || "Failed to publish");
      return;
    }
    onDone();
  };

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-5 space-y-4">
      <h2 className="font-semibold text-foreground">Publish</h2>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={() => act("publish")} className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm">
          {busy && <Loader2 size={14} className="animate-spin" />}
          Publish now
        </button>
        <button type="button" disabled={busy} onClick={() => act("submit")} className="px-4 py-2 border border-border rounded-lg hover:bg-background disabled:opacity-50 text-sm">
          Submit for review
        </button>
        <button type="button" disabled={busy} onClick={() => setShowSchedule((v) => !v)} className="px-4 py-2 border border-border rounded-lg hover:bg-background disabled:opacity-50 text-sm">
          Schedule…
        </button>
      </div>
      {showSchedule && (
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-border rounded-md px-3 py-2 bg-background text-sm" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="border border-border rounded-md px-3 py-2 bg-background text-sm" />
          <span className="text-xs text-caption">{timezone}</span>
          <button type="button" disabled={busy || !date} onClick={() => act("schedule")} className="px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm">
            Confirm schedule
          </button>
        </div>
      )}
      <p className="text-xs text-caption">
        &ldquo;Publish now&rdquo; and &ldquo;Schedule&rdquo; require publish rights for this content type. If you only have content-creation rights, use
        &ldquo;Submit for review&rdquo; to send it into the normal editorial queue.
      </p>
    </div>
  );
}
