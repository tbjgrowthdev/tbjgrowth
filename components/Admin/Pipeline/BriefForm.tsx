"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createPipelineRunAction } from "@/app/(admin)/actions/content-pipeline";
import type { Brief, PipelineContentType } from "@/lib/content-pipeline/types";

export default function BriefForm() {
  const router = useRouter();
  const [contentType, setContentType] = useState<PipelineContentType>("POST");
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("Professional, confident, no fluff");
  const [notes, setNotes] = useState("");
  const [clientName, setClientName] = useState("");
  const [industry, setIndustry] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [resultsHint, setResultsHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const brief: Brief = {
      contentType,
      topic,
      goal,
      audience,
      tone,
      notes: notes || undefined,
      ...(contentType === "CASE_STUDY" ? { clientName, industry, serviceType, resultsHint: resultsHint || undefined } : {}),
    };
    const result = await createPipelineRunAction(brief);
    setBusy(false);
    if (!result.success || !result.data) {
      setError(!result.success ? result.error : "Failed to create pipeline run");
      return;
    }
    router.push(`/admin/ai-pipeline/${result.data.id}`);
  };

  const canSubmit = topic.trim() && goal.trim() && audience.trim() && (contentType === "POST" || (clientName.trim() && industry.trim() && serviceType.trim()));

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6 max-w-2xl space-y-5">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Content type</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setContentType("POST")}
            className={`px-4 py-2 rounded-lg text-sm border ${contentType === "POST" ? "bg-brand-orange-deep text-white border-brand-orange-deep" : "border-border text-caption"}`}
          >
            Blog Post
          </button>
          <button
            type="button"
            onClick={() => setContentType("CASE_STUDY")}
            className={`px-4 py-2 rounded-lg text-sm border ${contentType === "CASE_STUDY" ? "bg-brand-orange-deep text-white border-brand-orange-deep" : "border-border text-caption"}`}
          >
            Case Study
          </button>
        </div>
      </div>

      <Field label="Topic" value={topic} onChange={setTopic} placeholder="e.g. Why most B2B SaaS SEO strategies plateau after month 6" />
      <Field label="Goal" value={goal} onChange={setGoal} placeholder="e.g. Generate demo bookings from mid-market SaaS marketing leads" />
      <Field label="Target audience" value={audience} onChange={setAudience} placeholder="e.g. Marketing leads at 50-200 person B2B SaaS companies" />
      <Field label="Tone" value={tone} onChange={setTone} />
      <TextArea label="Additional notes (optional)" value={notes} onChange={setNotes} placeholder="Anything specific to include, avoid, or emphasise" />

      {contentType === "CASE_STUDY" && (
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-5">
          <Field label="Client name" value={clientName} onChange={setClientName} />
          <Field label="Industry" value={industry} onChange={setIndustry} />
          <Field label="Service provided" value={serviceType} onChange={setServiceType} />
          <Field label="Results to feature (optional)" value={resultsHint} onChange={setResultsHint} placeholder="e.g. +180% organic traffic in 6 months" />
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        disabled={!canSubmit || busy}
        onClick={submit}
        className="flex items-center gap-2 px-5 py-2.5 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm font-medium"
      >
        {busy && <Loader2 size={16} className="animate-spin" />}
        Start pipeline
      </button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-border rounded-md px-3 py-2 bg-background text-sm"
      />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full border border-border rounded-md px-3 py-2 bg-background text-sm"
      />
    </div>
  );
}
