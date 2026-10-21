"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { approveAutomationStepAction, listAutomationRunsAction, rejectAutomationStepAction } from "@/app/(admin)/actions/automation";
import { ACTION_LABEL, EVENT_LABEL } from "@/lib/automation/types";

type Run = Awaited<ReturnType<typeof listAutomationRunsAction>>[number];

const RUN_STATUS_STYLE: Record<Run["status"], string> = {
  RUNNING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  SUCCEEDED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  AWAITING_APPROVAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  REJECTED: "bg-tint text-caption",
};

const STEP_ICON: Record<string, typeof CheckCircle2> = {
  SUCCEEDED: CheckCircle2,
  FAILED: XCircle,
  AWAITING_APPROVAL: Clock,
  PENDING: Clock,
  REJECTED: XCircle,
};

export default function RunsPanel({ initialRuns }: { initialRuns: Run[] }) {
  const router = useRouter();
  const [runs, setRuns] = useState(initialRuns);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyStepId, setBusyStepId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const next = await listAutomationRunsAction();
    setRuns(next);
  };

  const handleApprove = async (stepId: string) => {
    setBusyStepId(stepId);
    setError(null);
    const result = await approveAutomationStepAction(stepId);
    setBusyStepId(null);
    if (!result.success) setError(result.error);
    await refresh();
    router.refresh();
  };

  const handleReject = async (stepId: string) => {
    if (!confirm("Reject this step? The whole run will stop — later steps will never run.")) return;
    setBusyStepId(stepId);
    setError(null);
    const result = await rejectAutomationStepAction(stepId);
    setBusyStepId(null);
    if (!result.success) setError(result.error);
    await refresh();
    router.refresh();
  };

  if (runs.length === 0) {
    return <p className="text-sm text-caption">No automation runs yet — they start firing once a rule is enabled and its event happens (a content publish, or a new SEO performance signal).</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      {runs.map((run) => {
        const isExpanded = expandedId === run.id;
        const pendingApprovalStep = run.steps.find((s) => s.status === "AWAITING_APPROVAL");
        return (
          <div key={run.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
            <button type="button" onClick={() => setExpandedId(isExpanded ? null : run.id)} className="w-full flex items-start justify-between gap-3 text-left">
              <div>
                <p className="font-medium text-foreground">
                  {run.rule.name} — {run.contentTitle}
                </p>
                <p className="text-xs text-caption">
                  {EVENT_LABEL[run.event]} · {new Date(run.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${RUN_STATUS_STYLE[run.status]}`}>{run.status.replace("_", " ")}</span>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {isExpanded && (
              <div className="space-y-2 pt-2 border-t border-border">
                {run.steps.map((step) => {
                  const Icon = STEP_ICON[step.status] ?? Clock;
                  let output: Record<string, unknown> | null = null;
                  try {
                    output = step.output ? JSON.parse(step.output) : null;
                  } catch {
                    output = null;
                  }
                  return (
                    <div key={step.id} className="flex items-start gap-2 text-sm">
                      <Icon size={16} className="mt-0.5 text-muted shrink-0" />
                      <div className="flex-1">
                        <p className="text-foreground">{ACTION_LABEL[step.actionType]}</p>
                        {step.error && <p className="text-xs text-red-600 dark:text-red-400">{step.error}</p>}
                        {output && Object.keys(output).length > 0 && <p className="text-xs text-caption break-words">{JSON.stringify(output)}</p>}
                        {step.status === "AWAITING_APPROVAL" && step.id === pendingApprovalStep?.id && (
                          <div className="flex gap-2 mt-1">
                            <button
                              type="button"
                              disabled={busyStepId === step.id}
                              onClick={() => handleApprove(step.id)}
                              className="px-2 py-1 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 text-xs rounded-lg hover:bg-green-100 disabled:opacity-50"
                            >
                              Approve &amp; Run
                            </button>
                            <button
                              type="button"
                              disabled={busyStepId === step.id}
                              onClick={() => handleReject(step.id)}
                              className="px-2 py-1 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 text-xs rounded-lg hover:bg-red-100 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
