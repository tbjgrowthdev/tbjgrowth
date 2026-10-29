"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Plug, Save } from "lucide-react";
import { saveAiProviderSettings, testAiProviderConnection, type AiProviderOption, type AiProviderSettingsView } from "@/app/(admin)/actions/ai-settings";

const inputClass = "w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground";

function ProviderPicker({
  title,
  options,
  envProvider,
  provider,
  model,
  onProvider,
  onModel,
}: {
  title: string;
  options: AiProviderOption[];
  envProvider: string;
  provider: string;
  model: string;
  onProvider: (v: string) => void;
  onModel: (v: string) => void;
}) {
  const envLabel = options.find((o) => o.id === envProvider)?.label ?? envProvider;
  const selected = options.find((o) => o.id === provider) ?? null;
  const listId = `${title.replace(/\s+/g, "-").toLowerCase()}-models`;
  const unpriced = selected && model.trim() !== "" && !selected.pricedModels.includes(model.trim());

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <div>
        <label className="block text-sm font-medium text-muted mb-1">Provider</label>
        <select value={provider} onChange={(e) => onProvider(e.target.value)} className={inputClass}>
          <option value="">Server default ({envLabel}, from environment variables)</option>
          {options.map((o) => (
            <option key={o.id} value={o.id} disabled={!o.hasKey}>
              {o.label}
              {o.hasKey ? "" : ` — ${o.keyEnv} not set`}
            </option>
          ))}
        </select>
      </div>
      {selected && (
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Model</label>
          <input
            type="text"
            list={listId}
            value={model}
            onChange={(e) => onModel(e.target.value)}
            placeholder={selected.defaultModel}
            className={`${inputClass} font-mono text-sm`}
          />
          <datalist id={listId}>
            {selected.pricedModels.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <p className="text-xs text-caption mt-1">
            Leave blank to use <code>{selected.defaultModel}</code>.
          </p>
          {unpriced && (
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
              Cost tracking has no price for this model, so its jobs will show no cost on the AI Costs page (they still run normally).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AiProviderSettings({ initial }: { initial: AiProviderSettingsView }) {
  const router = useRouter();
  const [textProvider, setTextProvider] = useState(initial.saved.textProvider ?? "");
  const [textModel, setTextModel] = useState(initial.saved.textModel ?? "");
  const [imageProvider, setImageProvider] = useState(initial.saved.imageProvider ?? "");
  const [imageModel, setImageModel] = useState(initial.saved.imageModel ?? "");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const label = (id: string) => [...initial.textProviders, ...initial.imageProviders].find((o) => o.id === id)?.label ?? id;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const result = await saveAiProviderSettings({ textProvider: textProvider || null, textModel, imageProvider: imageProvider || null, imageModel });
    setSaving(false);
    if (result.success) {
      setMessage({ ok: true, text: "Saved. The next AI call uses this selection — no redeploy needed." });
      router.refresh();
    } else {
      setMessage({ ok: false, text: result.error });
    }
  };

  const test = async () => {
    setTesting(true);
    setMessage(null);
    const provider = textProvider || initial.env.textProvider;
    const result = await testAiProviderConnection({ provider, model: textProvider ? textModel : "" });
    setTesting(false);
    setMessage(
      result.success
        ? { ok: true, text: `${label(provider)} (${result.data.model}) responded in ${result.data.latencyMs} ms.` }
        : { ok: false, text: `${label(provider)} test failed: ${result.error}` }
    );
  };

  const { text, image } = initial.active;

  return (
    <div id="ai-provider" className="bg-card p-6 rounded-xl shadow-sm border border-border scroll-mt-6">
      <h2 className="text-xl font-bold text-foreground mb-2">AI Provider</h2>
      <p className="text-sm text-caption mb-4">
        Which AI service the content pipeline calls. Changes apply to the next AI call. API keys stay in the server&apos;s environment variables and
        can&apos;t be entered here; a provider without a configured key can&apos;t be selected.
      </p>

      <div className="text-sm bg-background border border-border rounded-lg p-3 mb-6 space-y-1">
        <p>
          <span className="text-muted">Active for text:</span> <strong>{label(text.provider)}</strong> <code className="text-xs">{text.model}</code>{" "}
          <span className="text-caption">({text.source === "admin" ? "set here" : "server default"})</span>
        </p>
        <p>
          <span className="text-muted">Active for images:</span> <strong>{label(image.provider)}</strong> <code className="text-xs">{image.model}</code>{" "}
          <span className="text-caption">({image.source === "admin" ? "set here" : "server default"})</span>
        </p>
      </div>

      {message && (
        <div className={`p-3 rounded-lg flex items-start gap-2 text-sm mb-4 ${message.ok ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
          {message.ok ? <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />}
          <span className="break-words">{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ProviderPicker
          title="Text generation"
          options={initial.textProviders}
          envProvider={initial.env.textProvider}
          provider={textProvider}
          model={textModel}
          onProvider={(v) => {
            setTextProvider(v);
            setTextModel("");
          }}
          onModel={setTextModel}
        />
        <div>
          <ProviderPicker
            title="Image generation"
            options={initial.imageProviders}
            envProvider={initial.env.imageProvider}
            provider={imageProvider}
            model={imageModel}
            onProvider={(v) => {
              setImageProvider(v);
              setImageModel("");
            }}
            onModel={setImageModel}
          />
          <p className="text-xs text-caption mt-2">Anthropic has no image API, so it isn&apos;t offered here. There&apos;s no image test: a real test would bill for a full image.</p>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3 pt-6 mt-6 border-t border-border">
        <button
          type="button"
          onClick={test}
          disabled={testing || saving}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-background disabled:opacity-50"
        >
          <Plug size={16} />
          {testing ? "Testing..." : "Test text provider"}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || testing}
          className="flex items-center gap-2 px-6 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save AI Provider"}
        </button>
      </div>
    </div>
  );
}
