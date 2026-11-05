"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePricingSettings } from "@/app/(admin)/actions/pricing";
import { CURRENCY_CODES } from "@/lib/pricing/currencies";
import { withToast } from "@/lib/admin/toast";
import { Card, Field, SaveButton, inputCls } from "./ui";

const FIELDS: { key: string; label: string; rows: number; hint?: string }[] = [
  { key: "eyebrow", label: "Eyebrow", rows: 1 },
  { key: "headline", label: "Main headline", rows: 2 },
  { key: "intro", label: "Intro paragraph", rows: 3 },
  { key: "upfront_offer", label: "Upfront offer box", rows: 2, hint: "Shown under the package tabs. Empty hides it." },
  { key: "contract_line", label: "Contract summary line", rows: 1, hint: "Shown next to the package button." },
  { key: "compare_title", label: "Comparison title", rows: 1 },
  { key: "compare_subtitle", label: "Comparison subtitle", rows: 2 },
];

export default function SettingsEditor({ values: initial, footnotes: initialFoot }: { values: Record<string, string>; footnotes: Record<string, string> }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [foot, setFoot] = useState(initialFoot);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await withToast(savePricingSettings(values, foot), { success: "Texts saved", error: "Couldn't save texts" });
      if (res.success) router.refresh();
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <Card title="Page texts">
        <div className="grid gap-4">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              <textarea rows={f.rows} className={inputCls} value={values[f.key] ?? ""} onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))} />
            </Field>
          ))}
        </div>
      </Card>
      <Card title="Footnotes" hint="One footnote per visible currency; a currency without its own falls back to the default. Identical footnotes are shown once.">
        <div className="grid gap-4">
          <Field label="Default footnote"><textarea rows={2} className={inputCls} value={foot[""] ?? ""} onChange={(e) => setFoot((s) => ({ ...s, "": e.target.value }))} /></Field>
          {CURRENCY_CODES.map((c) => (
            <Field key={c} label={`${c} footnote`} hint="Empty = use default">
              <textarea rows={2} className={inputCls} value={foot[c] ?? ""} onChange={(e) => setFoot((s) => ({ ...s, [c]: e.target.value }))} />
            </Field>
          ))}
        </div>
      </Card>
      <SaveButton saving={saving} />
    </form>
  );
}
