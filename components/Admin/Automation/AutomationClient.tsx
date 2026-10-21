"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Play, Pencil, Trash2 } from "lucide-react";
import {
  deleteAutomationRuleAction,
  listAutomationRulesAction,
  runAutomationRuleManuallyAction,
  toggleAutomationRuleAction,
} from "@/app/(admin)/actions/automation";
import { ACTION_LABEL, EVENT_LABEL, type ActionStep } from "@/lib/automation/types";
import type { ContentType } from "@/lib/generated/prisma/client";
import RuleFormModal from "./RuleFormModal";
import RunsPanel from "./RunsPanel";
import SocialDraftsPanel from "./SocialDraftsPanel";

type Rule = Awaited<ReturnType<typeof listAutomationRulesAction>>[number];
type RunsProp = Parameters<typeof RunsPanel>[0]["initialRuns"];
type DraftsProp = Parameters<typeof SocialDraftsPanel>[0]["initialDrafts"];

function parseActions(raw: string): ActionStep[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ActionStep[]) : [];
  } catch {
    return [];
  }
}

function TestRunRow({ rule }: { rule: Rule }) {
  const [contentType, setContentType] = useState<ContentType>("POST");
  const [contentId, setContentId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!contentId.trim()) return;
    setRunning(true);
    setStatus(null);
    const result = await runAutomationRuleManuallyAction(rule.id, contentType, contentId.trim());
    setRunning(false);
    setStatus(result.success ? "Started — check the Runs tab." : result.error);
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <select value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)} className="px-1.5 py-1 border border-border rounded bg-background text-foreground">
        <option value="POST">Post</option>
        <option value="PAGE">Page</option>
        <option value="CASE_STUDY">Case Study</option>
      </select>
      <input
        value={contentId}
        onChange={(e) => setContentId(e.target.value)}
        placeholder="Content ID"
        className="px-1.5 py-1 border border-border rounded bg-background text-foreground w-32"
      />
      <button type="button" disabled={running || !contentId.trim()} onClick={run} className="flex items-center gap-1 text-caption hover:text-foreground disabled:opacity-50">
        <Play size={12} /> Test run
      </button>
      {status && <span className="text-caption">{status}</span>}
    </div>
  );
}

function RulesPanel({ initialRules }: { initialRules: Rule[] }) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [modalRule, setModalRule] = useState<Rule | null | "new">(null);

  const refresh = async () => setRules(await listAutomationRulesAction());

  const handleToggle = async (rule: Rule) => {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)));
    const result = await toggleAutomationRuleAction(rule.id, !rule.enabled);
    if (!result.success) await refresh();
  };

  const handleDelete = async (rule: Rule) => {
    if (!confirm(`Delete rule "${rule.name}"? Its past runs stay in the Runs tab.`)) return;
    const result = await deleteAutomationRuleAction(rule.id);
    if (result.success) setRules((prev) => prev.filter((r) => r.id !== rule.id));
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setModalRule("new")}
        className="flex items-center gap-1.5 px-3 py-2 bg-brand-orange-deep text-white text-sm font-medium rounded-lg hover:bg-brand-orange"
      >
        <Plus size={16} /> New Rule
      </button>

      {rules.length === 0 && <p className="text-sm text-caption">No automation rules yet. Create one to chain actions off a publish, a ranking decline, or any other event.</p>}

      {rules.map((rule) => {
        const steps = parseActions(rule.actions);
        return (
          <div key={rule.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{rule.name}</p>
                {rule.description && <p className="text-xs text-caption">{rule.description}</p>}
                <p className="text-xs text-caption mt-1">
                  <span className="font-medium">{EVENT_LABEL[rule.event]}</span> → {steps.map((s) => ACTION_LABEL[s.type]).join(" → ")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-1.5 text-xs text-caption">
                  <input type="checkbox" checked={rule.enabled} onChange={() => handleToggle(rule)} />
                  Enabled
                </label>
                <button type="button" onClick={() => setModalRule(rule)} className="text-muted hover:text-foreground">
                  <Pencil size={16} />
                </button>
                <button type="button" onClick={() => handleDelete(rule)} className="text-red-600 dark:text-red-400 hover:underline">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <TestRunRow rule={rule} />
          </div>
        );
      })}

      {modalRule && (
        <RuleFormModal
          existing={modalRule === "new" ? null : modalRule}
          onClose={() => setModalRule(null)}
          onSaved={async () => {
            setModalRule(null);
            await refresh();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

export default function AutomationClient({ rules, runs, socialDrafts }: { rules: Rule[]; runs: RunsProp; socialDrafts: DraftsProp }) {
  const [tab, setTab] = useState<"rules" | "runs" | "social">("rules");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Webhook &amp; Automation Engine</h1>
        <p className="text-caption">Event → Condition → Action chains. Every action reuses an existing tool (the SEO audit, Content Refresh, the Integration Hub&apos;s Slack/Webhooks) — this engine is the wiring between them. Actions that write to live content need approval by default.</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {([
          ["rules", "Rules"],
          ["runs", "Runs"],
          ["social", "Social Drafts"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === key ? "border-brand-orange-deep text-brand-orange-deep dark:text-brand-orange-light" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "rules" && <RulesPanel initialRules={rules} />}
      {tab === "runs" && <RunsPanel initialRuns={runs} />}
      {tab === "social" && <SocialDraftsPanel initialDrafts={socialDrafts} />}
    </div>
  );
}
