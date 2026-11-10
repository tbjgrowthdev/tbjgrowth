"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Circle, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import {
  applyInternalLinksAction,
  approveRunAction,
  attachGeneratedImageAction,
  decideLinkSuggestionAction,
  publishRunAction,
  getPipelineRunAction,
  getJobsForRunAction,
  skipImageStageAction,
  attachOwnImageAction,
  updatePendingImageAltTextAction,
} from "@/app/(admin)/actions/content-pipeline";
import { PIPELINE_STAGE_ORDER, STAGE_LABEL, STALE_JOB_MS, isJobStale, nextStage } from "@/lib/content-pipeline/types";
import type { Brief, Research, SearchIntent, Outline, QaReport, QaCheck, LinkSuggestion, GeneratedImage } from "@/lib/content-pipeline/types";
import { describeActionError, requestPipelineStage } from "@/lib/admin/action-errors";
import ImageInput from "@/components/Admin/Media/ImageInput";
import { toast, withToast } from "@/lib/admin/toast";
import PageTitle from "@/components/Admin/PageTitle";

type RunAndContent = NonNullable<Awaited<ReturnType<typeof getPipelineRunAction>>> & { jobs: Awaited<ReturnType<typeof getJobsForRunAction>> };
type Job = RunAndContent["jobs"][number];
type ActionResult = { success: boolean; error?: string };
type Act = (fn: () => Promise<ActionResult>, fallback?: string) => Promise<boolean>;

const POLL_MS = 5_000;

const isRunning = (job: Job) => (job.status === "PROCESSING" || job.status === "QUEUED") && !isJobStale(job);
const attemptKey = (job: Job) => `${job.id}@${job.startedAt ? new Date(job.startedAt).getTime() : 0}`;
const stageName = (stage: string) => STAGE_LABEL[stage as keyof typeof STAGE_LABEL] ?? stage;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

// Stages the generic "whatever comes next" button can run. INTERNAL_LINKS
// is deliberately not here — it gets its own InternalLinksReviewCard with a
// bundled generate/regenerate trigger, same reason IMAGE isn't here either
// (see that card's own comment). All of these (plus IMAGE and
// INTERNAL_LINKS) run through the streaming stage endpoint — see runAiStage.
const GENERIC_AI_STAGES = new Set(["SEARCH_INTENT", "RESEARCH", "OUTLINE", "DRAFT", "SEO", "SCHEMA", "QA"]);

export default function PipelineWizard({ run, content, jobs }: RunAndContent) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown while waiting on a stage whose request was lost but whose job may still be running.
  const [notice, setNotice] = useState<string | null>(null);
  const [showOwnImage, setShowOwnImage] = useState(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setBusyBoth = (value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  };

  // Non-AI actions (approve, attach, skip, publish...). A rejected Server
  // Action (dropped connection, 5xx) must still clear the busy state.
  const act: Act = async (fn, fallback = "Something went wrong") => {
    setBusyBoth(true);
    setError(null);
    try {
      const result = await fn();
      if (!result.success) {
        setError(result.error || fallback);
        return false;
      }
      router.refresh();
      return true;
    } catch (err) {
      setError(describeActionError(err, fallback));
      return false;
    } finally {
      setBusyBoth(false);
    }
  };

  /**
   * Polls this run's jobs until nothing is running for `stage`, then
   * reports how the attempt ended. `known` holds the job attempts that
   * existed before this attempt started, so an old FAILED/COMPLETED row
   * isn't mistaken for this attempt's outcome.
   */
  const watchStage = useCallback(
    async (stage: string, known: Set<string>, reason: string) => {
      const label = stageName(stage);
      setNotice(`${reason} Checking whether ${label} is still running on the server…`);
      const deadline = Date.now() + STALE_JOB_MS + 60_000;
      let quietPolls = 0;
      try {
        while (mountedRef.current && Date.now() < deadline) {
          await sleep(POLL_MS);
          if (!mountedRef.current) return;
          let latest: Job[];
          try {
            latest = await getJobsForRunAction(run.id);
          } catch {
            setNotice(`Still can't reach the server. Retrying every ${POLL_MS / 1000}s…`);
            continue;
          }
          const stageJobs = latest.filter((j) => j.stage === stage);
          if (stageJobs.some(isRunning)) {
            quietPolls = 0;
            setNotice(`${label} is still running on the server. This page will update when it finishes.`);
            continue;
          }
          // Two quiet polls in a row: IMAGE runs two jobs back to back (image, then alt text).
          if (++quietPolls < 2) continue;

          const attempts = stageJobs.filter((j) => !known.has(attemptKey(j)));
          router.refresh();
          if (attempts.some((j) => j.status === "COMPLETED")) {
            setError(null);
            toast.success(`${label} complete`);
          } else {
            const failed = attempts.find((j) => j.status === "FAILED");
            setError(failed ? `${label} failed: ${failed.error || "unknown error"}` : `${reason} ${label} never started on the server — try again.`);
            toast.error(`${label} failed`, { description: failed?.error || "It never started on the server — try again." });
          }
          return;
        }
        if (mountedRef.current) {
          setError(`${label} still hasn't reported a result. Reload this page in a few minutes to check.`);
          toast.info(`${label} is taking longer than expected`, { description: "Reload the page in a few minutes to check." });
        }
      } finally {
        setNotice(null);
      }
    },
    [run.id, router]
  );

  // Every AI stage goes through the streaming endpoint, which keeps the
  // connection alive during long AI calls. If the connection drops anyway,
  // the job keeps going on the server, so poll for its result rather than
  // reporting a failure that may not have happened.
  const runAiStage = async (stage: string) => {
    if (busyRef.current) return;
    setBusyBoth(true);
    setError(null);
    const known = new Set(jobs.filter((j) => !isRunning(j)).map(attemptKey));
    try {
      const result = await requestPipelineStage(run.id, stage);
      if (result.success) {
        toast.success(`${stageName(stage)} complete`);
        router.refresh();
        return;
      }
      if (result.connectionLost) {
        await watchStage(stage, known, result.error || "Lost connection.");
        return;
      }
      // A refusal can mean another tab/click is already running this stage — wait for that one.
      let latest: Job[] = [];
      try {
        latest = await getJobsForRunAction(run.id);
      } catch {
        // fall through to showing the error
      }
      if (latest.some((j) => j.stage === stage && isRunning(j))) {
        await watchStage(stage, known, "");
        return;
      }
      setError(result.error || `${stageName(stage)} failed`);
      toast.error(`${stageName(stage)} failed`, result.error ? { description: result.error } : undefined);
      router.refresh(); // shows the FAILED job row and its Retry label
    } finally {
      setBusyBoth(false);
    }
  };

  // Opening (or reloading) the page while a stage is still running on the
  // server: show it as running and pick up the result, instead of offering
  // a button that would only be refused.
  useEffect(() => {
    const running = jobs.find(isRunning);
    if (!running) return;
    const known = new Set(jobs.filter((j) => !isRunning(j)).map(attemptKey));
    const timer = setTimeout(() => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      watchStage(running.stage, known, "").finally(() => {
        busyRef.current = false;
        setBusy(false);
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [jobs, watchStage]);

  const brief = parse<Brief>(run.brief);
  const searchIntent = parse<SearchIntent>(run.searchIntent);
  const research = parse<Research>(run.research);
  const outline = parse<Outline>(run.outline);
  const internalLinks = parse<LinkSuggestion[]>(run.internalLinks);
  const qaReport = parse<QaReport>(run.qaReport);
  const generatedImage = parse<GeneratedImage>(run.generatedImage);

  const upcoming = nextStage(run.stage);
  const imageFolder = run.contentType === "CASE_STUDY" ? "Case Studies" : "Blog";
  const imageAltSuggestion = outline?.title || brief?.topic || "";
  const currentIndex = PIPELINE_STAGE_ORDER.indexOf(run.stage);
  const pendingJob = upcoming ? jobs.find((j) => j.stage === upcoming) : undefined;

  const editorHref = run.contentId ? (run.contentType === "POST" ? `/admin/posts/${run.contentId}` : `/admin/cases/${run.contentId}`) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageTitle>{brief?.topic || "AI Content Pipeline Run"}</PageTitle>
          <p className="text-caption">{run.contentType === "CASE_STUDY" ? "Case Study" : "Blog Post"}</p>
        </div>
        {editorHref && (
          <Link href={editorHref} target="_blank" className="flex items-center gap-1.5 text-sm text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light shrink-0">
            Open in full editor <ExternalLink size={14} />
          </Link>
        )}
      </div>

      <Stepper currentIndex={currentIndex} />

      {notice && (
        <div role="status" className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-3">
          <Loader2 size={16} className="animate-spin shrink-0" />
          {notice}
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">
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
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-caption max-h-64 overflow-y-auto scrollbar-thin border border-border rounded-md p-4" dangerouslySetInnerHTML={{ __html: content.content }} />
        </StageCard>
      )}

      {generatedImage && (
        <ImageReviewCard
          runId={run.id}
          image={generatedImage}
          busy={busy}
          act={act}
          onRegenerate={() => runAiStage("IMAGE")}
          setError={setError}
          onDone={() => router.refresh()}
          folder={imageFolder}
          defaultAltText={imageAltSuggestion}
        />
      )}

      {run.stage === "DRAFT" && !generatedImage && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <ActionBar busy={busy} label="Generate Image" onClick={() => runAiStage("IMAGE")} />
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowOwnImage((v) => !v)}
              aria-expanded={showOwnImage}
              className="px-5 py-3 border border-border rounded-lg hover:bg-background disabled:opacity-50 text-sm whitespace-nowrap"
            >
              Use my own image
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => withToast(skipImageStageAction(run.id), { success: "Image step skipped", error: "Couldn't skip image step" }))}
              className="px-5 py-3 border border-border rounded-lg hover:bg-background disabled:opacity-50 text-sm whitespace-nowrap"
            >
              Skip
            </button>
          </div>
          {showOwnImage && (
            <OwnImagePanel runId={run.id} busy={busy} act={act} folder={imageFolder} defaultAltText={imageAltSuggestion} onCancel={() => setShowOwnImage(false)} />
          )}
        </div>
      )}
      {content?.metaTitle && (
        <StageCard title="SEO" done>
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <Dl label="Meta title" value={`${content.metaTitle} (${content.metaTitle.length} chars)`} />
            <Dl label="Meta description" value={`${content.metaDescription} (${content.metaDescription?.length ?? 0} chars)`} />
          </dl>
        </StageCard>
      )}

      {run.stage === "SEO" && (
        <InternalLinksReviewCard
          runId={run.id}
          suggestions={internalLinks}
          busy={busy}
          act={act}
          onGenerate={() => runAiStage("INTERNAL_LINKS")}
          setError={setError}
          onDone={() => router.refresh()}
        />
      )}

      {internalLinks && run.stage !== "SEO" && (
        <StageCard title="Internal Links" done>
          {internalLinks.length === 0 ? (
            <p className="text-sm text-caption">No internal links were applied.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {internalLinks.map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  {l.applied ? <CheckCircle2 size={14} className="text-green-600 shrink-0" /> : <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
                  <span className="text-foreground">&ldquo;{l.anchorText}&rdquo;</span>
                  <span className="text-caption">→ {l.targetUrl}</span>
                  <span className="text-xs text-caption">({l.status === "approved" && !l.applied ? "approved, not applied" : l.status})</span>
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
        <StageCard title="Quality Gate" done>
          <p className="text-sm text-caption mb-3">{qaReport.summary} — {qaReport.wordCount} words.</p>
          <div className="space-y-3">
            {groupChecksByCategory(qaReport.checks).map(([category, checks]) => (
              <div key={category}>
                <div className="text-xs font-medium text-caption uppercase tracking-wide mb-1">{category}</div>
                <ul className="space-y-1 text-sm">
                  {checks.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {c.passed ? <CheckCircle2 size={14} className="text-green-600 mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />}
                      <span>
                        <span className="text-foreground">{c.label}</span>
                        {c.note && <span className="text-caption"> — {c.note}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {!qaReport.overallPassed && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-4">
              One or more checks didn&apos;t pass — review the notes above. This is advisory, not a block: human approval is mandatory either way, and it&apos;s the
              approver&apos;s call.
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
      {upcoming && upcoming !== "PUBLISHED" && run.stage !== "APPROVAL" && GENERIC_AI_STAGES.has(upcoming) && (
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
            onClick={() => runAiStage(upcoming)}
          />
        </>
      )}

      {run.stage === "QA" && (
        <ActionBar busy={busy} label="Approve for publish" onClick={() => act(() => withToast(approveRunAction(run.id), { success: "Approved for publishing", error: "Couldn't approve" }))} />
      )}

      {run.stage === "APPROVAL" && <PublishPanel runId={run.id} busy={busy} act={act} />}

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

// Preserves first-seen order across the 10 named categories rather than
// alphabetizing — matches the order quality-gate checks are actually
// produced in (lib/content-pipeline/stages.ts's runQaStage).
function groupChecksByCategory(checks: QaCheck[]): [string, QaCheck[]][] {
  const order: string[] = [];
  const byCategory = new Map<string, QaCheck[]>();
  for (const check of checks) {
    if (!byCategory.has(check.category)) {
      byCategory.set(check.category, []);
      order.push(check.category);
    }
    byCategory.get(check.category)!.push(check);
  }
  return order.map((category) => [category, byCategory.get(category)!]);
}

function KeywordChip({ keyword, volume, highlight }: { keyword: string; volume?: number | null; highlight?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border mr-2 mb-1 ${highlight ? "bg-brand-orange-deep text-white border-brand-orange-deep" : "border-border text-caption"}`}>
      {keyword}
      {typeof volume === "number" && <span className="opacity-70">· {volume}/mo</span>}
    </span>
  );
}

function ImageReviewCard({
  runId,
  image,
  busy,
  act,
  onRegenerate,
  setError,
  onDone,
  folder,
  defaultAltText,
}: {
  runId: string;
  image: GeneratedImage;
  busy: boolean;
  act: Act;
  onRegenerate: () => void;
  setError: (v: string | null) => void;
  onDone: () => void;
  folder: string;
  defaultAltText: string;
}) {
  const [altText, setAltText] = useState(image.altText);
  const [savingAlt, setSavingAlt] = useState(false);
  const [showOwnImage, setShowOwnImage] = useState(false);

  const saveAltText = async () => {
    setSavingAlt(true);
    setError(null);
    try {
      const result = await withToast(updatePendingImageAltTextAction(runId, altText), { success: "Alt text saved", error: "Couldn't save alt text" });
      if (!result.success) {
        setError(result.error || "Failed to save alt text");
        return;
      }
      onDone();
    } catch (err) {
      setError(describeActionError(err, "Failed to save alt text"));
    } finally {
      setSavingAlt(false);
    }
  };

  const altTextChanged = altText !== image.altText;

  return (
    <StageCard title="Image" done={image.approved}>
      <div className="flex flex-col sm:flex-row gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={image.altText} className="w-40 h-40 object-cover rounded-md border border-border shrink-0" />
        <div className="flex-1 space-y-2">
          <div>
            <label className="text-xs text-caption">Alt text</label>
            {image.approved ? (
              <p className="text-sm text-foreground">{image.altText}</p>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  className="flex-1 px-2 py-1 border border-border rounded-md bg-background text-sm text-foreground"
                />
                {altTextChanged && (
                  <button
                    type="button"
                    disabled={savingAlt || !altText.trim()}
                    onClick={saveAltText}
                    className="px-3 py-1 border border-border rounded-md hover:bg-background disabled:opacity-50 text-xs shrink-0"
                  >
                    {savingAlt ? "Saving…" : "Save"}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="text-xs text-caption">
            {image.provider === "manual" ? "Chosen by you" : `${image.provider} / ${image.model}`}
          </div>
          {image.approved ? (
            <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 size={14} /> Attached to content
            </p>
          ) : (
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={busy || altTextChanged}
                onClick={() => act(() => withToast(attachGeneratedImageAction(runId), { success: "Image attached", error: "Couldn't attach image" }))}
                className="px-3 py-1.5 bg-brand-orange-deep text-white rounded-md hover:bg-brand-orange disabled:opacity-50 text-xs font-medium"
                title={altTextChanged ? "Save your alt text edit first" : undefined}
              >
                Approve & Attach
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onRegenerate}
                className="px-3 py-1.5 border border-border rounded-md hover:bg-background disabled:opacity-50 text-xs"
              >
                Regenerate
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowOwnImage((v) => !v)}
                aria-expanded={showOwnImage}
                className="px-3 py-1.5 border border-border rounded-md hover:bg-background disabled:opacity-50 text-xs"
              >
                Use a different image
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => act(() => withToast(skipImageStageAction(runId), { success: "Image step skipped", error: "Couldn't skip image step" }))}
                className="px-3 py-1.5 text-caption hover:text-foreground text-xs underline"
              >
                Skip
              </button>
            </div>
          )}
        </div>
      </div>
      {showOwnImage && !image.approved && (
        <div className="mt-4">
          <OwnImagePanel runId={runId} busy={busy} act={act} folder={folder} defaultAltText={image.altText || defaultAltText} onCancel={() => setShowOwnImage(false)} />
        </div>
      )}
    </StageCard>
  );
}

// Lets the human supply the featured image instead of generating one, with
// the admin's shared image field (URL, upload, drag & drop, Media Library).
// Attaching it completes the Image stage directly — see attachOwnImage in
// lib/content-pipeline/stages.ts.
function OwnImagePanel({
  runId,
  busy,
  act,
  folder,
  defaultAltText,
  onCancel,
}: {
  runId: string;
  busy: boolean;
  act: Act;
  folder: string;
  defaultAltText: string;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState("");
  const [altText, setAltText] = useState(defaultAltText);

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-5 space-y-4">
      <h3 className="font-semibold text-foreground">Use your own image</h3>
      <ImageInput
        label="Featured image"
        folder={folder}
        value={url}
        onChange={setUrl}
        altText={altText}
        onAltTextChange={setAltText}
        defaultAltText={defaultAltText}
        previewClassName="w-40 h-24"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !url.trim() || !altText.trim()}
          title={!altText.trim() ? "Add alt text first" : undefined}
          onClick={() => act(() => withToast(attachOwnImageAction(runId, url, altText), { success: "Image attached", error: "Couldn't attach image" }), "Failed to attach the image")}
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm font-medium"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Attach image
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-tint">
          Cancel
        </button>
      </div>
    </div>
  );
}

// Bundles its own generate/regenerate trigger (same reason ImageReviewCard
// does) rather than going through the generic "whatever comes next" action
// bar — this stage has its own multi-row review state that a single
// generic button can't represent. "Source" is this run's own content
// title, shown as its own column for every row even though it's constant
// here — see LinkSuggestion's own comment on why.
function InternalLinksReviewCard({
  runId,
  suggestions,
  busy,
  act,
  onGenerate,
  setError,
  onDone,
}: {
  runId: string;
  suggestions: LinkSuggestion[] | null;
  busy: boolean;
  act: Act;
  onGenerate: () => void;
  setError: (v: string | null) => void;
  onDone: () => void;
}) {
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const generate = onGenerate;

  const decide = async (suggestionId: string, decision: "approved" | "rejected") => {
    setDecidingId(suggestionId);
    setError(null);
    try {
      const result = await withToast(decideLinkSuggestionAction(runId, suggestionId, decision), { success: null, error: "Couldn't record decision" });
      if (!result.success) {
        setError(result.error || "Failed to record decision");
        return;
      }
      onDone();
    } catch (err) {
      setError(describeActionError(err, "Failed to record decision"));
    } finally {
      setDecidingId(null);
    }
  };

  const apply = () => act(() => withToast(applyInternalLinksAction(runId), { success: "Internal links applied", error: "Couldn't apply internal links" }), "Failed to apply internal links");

  if (!suggestions) {
    return <ActionBar busy={busy} label="Generate Internal Link Suggestions" onClick={generate} />;
  }

  const pendingCount = suggestions.filter((s) => s.status === "pending").length;

  return (
    <StageCard title="Internal Links">
      <p className="text-xs text-caption mb-3">AI suggestions — each needs your approval or rejection before they can be applied.</p>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <div key={s.id} className="border border-border rounded-md p-3 text-sm space-y-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-caption">Source: </span>
                <span className="text-foreground">{s.sourceTitle}</span>
              </div>
              <div>
                <span className="text-xs text-caption">Target: </span>
                <span className="text-foreground">{s.targetTitle}</span>
              </div>
            </div>
            <div>
              <span className="text-xs text-caption">Anchor: </span>
              <span className="text-foreground">&ldquo;{s.anchorText}&rdquo;</span>
            </div>
            <div>
              <span className="text-xs text-caption">Reason: </span>
              <span className="text-caption">{s.reason}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              {s.status === "pending" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={decidingId === s.id}
                    onClick={() => decide(s.id, "approved")}
                    className="px-3 py-1 bg-brand-orange-deep text-white rounded-md hover:bg-brand-orange disabled:opacity-50 text-xs"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={decidingId === s.id}
                    onClick={() => decide(s.id, "rejected")}
                    className="px-3 py-1 border border-border rounded-md hover:bg-background disabled:opacity-50 text-xs"
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <span className={`flex items-center gap-1.5 text-xs ${s.status === "approved" ? "text-green-600 dark:text-green-400" : "text-caption"}`}>
                  {s.status === "approved" && <CheckCircle2 size={12} />}
                  {s.status === "invalid" ? `Invalid — ${s.invalidReason}` : s.status}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <button
          type="button"
          disabled={busy || pendingCount > 0}
          onClick={apply}
          title={pendingCount > 0 ? "Every suggestion needs a decision first" : undefined}
          className="px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm font-medium"
        >
          {pendingCount > 0 ? `Apply Links (${pendingCount} pending)` : "Apply Links"}
        </button>
        <button type="button" disabled={busy} onClick={generate} className="px-4 py-2 border border-border rounded-lg hover:bg-background disabled:opacity-50 text-sm">
          Regenerate suggestions
        </button>
      </div>
    </StageCard>
  );
}

function PublishPanel({
  runId,
  busy,
  act: runAct,
}: {
  runId: string;
  busy: boolean;
  act: Act;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [showSchedule, setShowSchedule] = useState(false);

  const act = (mode: "publish" | "submit" | "schedule") =>
    runAct(
      () =>
        withToast(publishRunAction(runId, mode, mode === "schedule" ? { date, time, timezone } : undefined), {
          success: mode === "publish" ? "Published" : mode === "submit" ? "Submitted for review" : "Publishing scheduled",
          error: mode === "publish" ? "Couldn't publish" : mode === "submit" ? "Couldn't submit for review" : "Couldn't schedule",
        }),
      "Failed to publish"
    );

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
