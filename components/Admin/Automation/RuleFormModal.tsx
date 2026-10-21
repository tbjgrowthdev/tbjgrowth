"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { createAutomationRuleAction, updateAutomationRuleAction } from "@/app/(admin)/actions/automation";
import { getAssignableUsers } from "@/app/(admin)/actions/admins";
import {
  ACTION_DESCRIPTION,
  ACTION_LABEL,
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_EVENTS,
  DEFAULT_REQUIRES_APPROVAL,
  EVENT_LABEL,
  SIGNAL_EVENTS,
  type ActionStep,
  type AutomationActionType,
  type AutomationEvent,
  type RuleConditions,
} from "@/lib/automation/types";
import type { ContentType, PerformanceFeedbackSeverity } from "@/lib/generated/prisma/client";

const CONTENT_TYPES: ContentType[] = ["POST", "PAGE", "CASE_STUDY"];
const SEVERITIES: PerformanceFeedbackSeverity[] = ["HIGH", "MEDIUM", "LOW"];

type RuleRow = {
  id: string;
  name: string;
  description: string | null;
  event: AutomationEvent;
  conditions: string | null;
  actions: string;
  enabled: boolean;
};

function parseConditions(raw: string | null): RuleConditions {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as RuleConditions;
  } catch {
    return {};
  }
}

function parseActions(raw: string): ActionStep[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ActionStep[]) : [];
  } catch {
    return [];
  }
}

export default function RuleFormModal({ existing, onClose, onSaved }: { existing: RuleRow | null; onClose: () => void; onSaved: () => void }) {
  const initialConditions = useMemo(() => parseConditions(existing?.conditions ?? null), [existing]);

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [event, setEvent] = useState<AutomationEvent>(existing?.event ?? "CONTENT_PUBLISHED");
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [contentTypes, setContentTypes] = useState<ContentType[]>(initialConditions.contentTypes ?? []);
  const [severities, setSeverities] = useState<PerformanceFeedbackSeverity[]>(initialConditions.severities ?? []);
  const [steps, setSteps] = useState<ActionStep[]>(existing ? parseActions(existing.actions) : []);
  const [newStepType, setNewStepType] = useState<AutomationActionType>("NOTIFY_TEAM");
  const [reviewerPool, setReviewerPool] = useState<{ id: string; name: string | null; email: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAssignableUsers("APPROVE").then((users) => setReviewerPool(users));
  }, []);

  const isSignalEvent = SIGNAL_EVENTS.includes(event);

  const toggleContentType = (ct: ContentType) => {
    setContentTypes((prev) => (prev.includes(ct) ? prev.filter((c) => c !== ct) : [...prev, ct]));
  };
  const toggleSeverity = (s: PerformanceFeedbackSeverity) => {
    setSeverities((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { type: newStepType, config: {}, requiresApproval: DEFAULT_REQUIRES_APPROVAL[newStepType] }]);
  };
  const removeStep = (index: number) => setSteps((prev) => prev.filter((_, i) => i !== index));
  const moveStep = (index: number, direction: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const updateStepConfig = (index: number, key: string, value: string) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, config: { ...s.config, [key]: value } } : s)));
  };
  const updateStepApproval = (index: number, value: boolean) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, requiresApproval: value } : s)));
  };

  const submit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (steps.length === 0) {
      setError("Add at least one action");
      return;
    }
    setSaving(true);
    setError(null);
    const input = {
      name: name.trim(),
      description: description.trim() || undefined,
      event,
      enabled,
      conditions: { contentTypes: contentTypes.length ? contentTypes : undefined, severities: isSignalEvent && severities.length ? severities : undefined } as RuleConditions,
      actions: steps,
    };
    const result = existing ? await updateAutomationRuleAction(existing.id, input) : await createAutomationRuleAction(input);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-lg shadow-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{existing ? "Edit Rule" : "New Automation Rule"}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-caption mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground" />
          </div>
          <div>
            <label className="block text-xs font-medium text-caption mb-1">Description (optional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground" />
          </div>
          <div>
            <label className="block text-xs font-medium text-caption mb-1">Event</label>
            <select
              value={event}
              onChange={(e) => setEvent(e.target.value as AutomationEvent)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground"
            >
              {AUTOMATION_EVENTS.map((ev) => (
                <option key={ev} value={ev}>
                  {EVENT_LABEL[ev]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enabled
          </label>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Conditions (optional — no selection means no filter)</p>
          <div>
            <p className="text-xs text-caption mb-1">Content type</p>
            <div className="flex gap-3">
              {CONTENT_TYPES.map((ct) => (
                <label key={ct} className="flex items-center gap-1.5 text-sm text-foreground">
                  <input type="checkbox" checked={contentTypes.includes(ct)} onChange={() => toggleContentType(ct)} />
                  {ct}
                </label>
              ))}
            </div>
          </div>
          {isSignalEvent && (
            <div>
              <p className="text-xs text-caption mb-1">Severity</p>
              <div className="flex gap-3">
                {SEVERITIES.map((s) => (
                  <label key={s} className="flex items-center gap-1.5 text-sm text-foreground">
                    <input type="checkbox" checked={severities.includes(s)} onChange={() => toggleSeverity(s)} />
                    {s}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Actions (run in this order)</p>
          {steps.map((step, index) => (
            <div key={index} className="bg-background border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {index + 1}. {ACTION_LABEL[step.type]}
                  </p>
                  <p className="text-xs text-caption">{ACTION_DESCRIPTION[step.type]}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} className="text-muted hover:text-foreground disabled:opacity-30">
                    <ChevronUp size={16} />
                  </button>
                  <button type="button" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} className="text-muted hover:text-foreground disabled:opacity-30">
                    <ChevronDown size={16} />
                  </button>
                  <button type="button" onClick={() => removeStep(index)} className="text-red-600 dark:text-red-400 hover:underline ml-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {step.type === "NOTIFY_TEAM" && (
                <div className="flex gap-2">
                  <select
                    value={step.config.channel ?? ""}
                    onChange={(e) => updateStepConfig(index, "channel", e.target.value)}
                    className="px-2 py-1.5 text-sm border border-border rounded-lg bg-card text-foreground"
                  >
                    <option value="">Select channel…</option>
                    <option value="slack">Slack</option>
                    <option value="webhook">Webhook</option>
                    <option value="email">Email</option>
                  </select>
                  {step.config.channel === "slack" && (
                    <input
                      value={step.config.target ?? ""}
                      onChange={(e) => updateStepConfig(index, "target", e.target.value)}
                      placeholder="#channel override (optional)"
                      className="flex-1 px-2 py-1.5 text-sm border border-border rounded-lg bg-card text-foreground"
                    />
                  )}
                </div>
              )}

              {step.type === "ASSIGN_REVIEWER" && (
                <select
                  value={step.config.userId ?? ""}
                  onChange={(e) => updateStepConfig(index, "userId", e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-border rounded-lg bg-card text-foreground"
                >
                  <option value="">Select reviewer…</option>
                  {reviewerPool.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
              )}

              <label className="flex items-center gap-2 text-xs text-caption">
                <input type="checkbox" checked={step.requiresApproval} onChange={(e) => updateStepApproval(index, e.target.checked)} />
                Requires human approval before running
              </label>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <select
              value={newStepType}
              onChange={(e) => setNewStepType(e.target.value as AutomationActionType)}
              className="flex-1 px-2 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground"
            >
              {AUTOMATION_ACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ACTION_LABEL[type]}
                </option>
              ))}
            </select>
            <button type="button" onClick={addStep} className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-background">
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="px-4 py-2 bg-brand-orange-deep text-white text-sm font-medium rounded-lg hover:bg-brand-orange disabled:opacity-50"
          >
            {saving ? "Saving…" : existing ? "Save Changes" : "Create Rule"}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 border border-border text-sm rounded-lg hover:bg-background">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
