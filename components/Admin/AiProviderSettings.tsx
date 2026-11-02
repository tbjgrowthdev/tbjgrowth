"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, KeyRound, Plug, Save, Trash2 } from "lucide-react";
import {
  removeAiProviderKey,
  saveAiProviderKey,
  saveAiProviderSettings,
  testAiProviderConnection,
  type AiKeyStatus,
  type AiProviderOption,
  type AiProviderSettingsView,
} from "@/app/(admin)/actions/ai-settings";
import { describeActionError } from "@/lib/admin/action-errors";

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
              {o.hasKey ? "" : " — no API key (add one below)"}
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

const SOURCE_BADGE: Record<AiKeyStatus["source"], { text: string; className: string }> = {
  admin: { text: "Configured here", className: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" },
  env: { text: "From environment variable", className: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
  none: { text: "Not configured", className: "bg-background text-caption border border-border" },
};

function KeyRow({ status, testModel, disabled, onChange }: { status: AiKeyStatus; testModel: string; disabled: boolean; onChange: (s: AiKeyStatus) => void }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"save" | "remove" | "test" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const badge = SOURCE_BADGE[status.source];

  const save = async () => {
    setBusy("save");
    try {
      setMessage(null);
      const result = await saveAiProviderKey({ provider: status.provider, apiKey: draft });
      if (result.success) {
        setDraft(""); // drop the plaintext key from the browser as soon as it's stored
        onChange(result.data);
        setMessage({ ok: true, text: "Key saved (encrypted). Use Test connection to verify it." });
      } else {
        setMessage({ ok: false, text: result.error });
      }
    } catch (err) {
      setMessage({ ok: false, text: describeActionError(err) });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("remove");
    try {
      setMessage(null);
      const result = await removeAiProviderKey({ provider: status.provider });
      setConfirmRemove(false);
      if (result.success) {
        onChange(result.data);
        setMessage({ ok: true, text: result.data.source === "env" ? `Removed. Calls now use ${status.keyEnv}.` : "Removed." });
      } else {
        setMessage({ ok: false, text: result.error });
      }
    } catch (err) {
      setMessage({ ok: false, text: describeActionError(err) });
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      setMessage(null);
      const result = await testAiProviderConnection({ provider: status.provider, model: testModel });
      setMessage(result.success ? { ok: true, text: `Responded in ${result.data.latencyMs} ms (${result.data.model}).` } : { ok: false, text: result.error });
    } catch (err) {
      setMessage({ ok: false, text: describeActionError(err) });
    } finally {
      setBusy(null);
    }
  };

  const secondaryButton = "flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-background disabled:opacity-50";

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-foreground">{status.label}</strong>
        <span className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}>{badge.text}</span>
        {status.maskedKey && <code className="text-xs text-muted">{status.maskedKey}</code>}
        <span className="text-xs text-caption ml-auto">env: {status.keyEnv}</span>
      </div>
      {status.storedKeyUnreadable && (
        <p className="text-xs text-yellow-700 dark:text-yellow-400">
          A key is stored here but can&apos;t be decrypted (was INTEGRATION_ENCRYPTION_KEY changed?), so calls use the environment variable instead. Re-enter the key to fix this.
        </p>
      )}
      {status.lastError && status.source === "admin" && <p className="text-xs text-red-700 dark:text-red-400 break-words">Last test failed: {status.lastError}</p>}
      <div className="flex flex-wrap gap-2">
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={status.source === "admin" ? "Enter a new key to replace the stored one" : "Paste API key"}
          className={`${inputClass} flex-1 min-w-[12rem] font-mono text-sm`}
          aria-label={`${status.label} API key`}
        />
        <button
          type="button"
          onClick={save}
          disabled={disabled || busy !== null || draft.trim() === ""}
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
        >
          <KeyRound size={16} />
          {busy === "save" ? "Saving..." : status.source === "admin" ? "Replace key" : "Save key"}
        </button>
        <button type="button" onClick={test} disabled={busy !== null || status.source === "none"} className={`${secondaryButton} text-foreground`}>
          <Plug size={16} />
          {busy === "test" ? "Testing..." : "Test connection"}
        </button>
        {status.source === "admin" &&
          (confirmRemove ? (
            <>
              <button type="button" onClick={remove} disabled={busy !== null} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                <Trash2 size={16} />
                {busy === "remove" ? "Removing..." : "Confirm remove"}
              </button>
              <button type="button" onClick={() => setConfirmRemove(false)} disabled={busy !== null} className="px-3 py-2 text-sm text-muted hover:text-foreground">
                Cancel
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmRemove(true)} disabled={busy !== null} className={`${secondaryButton} text-red-700 dark:text-red-400`}>
              <Trash2 size={16} />
              Remove key
            </button>
          ))}
      </div>
      {message && <p className={`text-xs break-words ${message.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{message.text}</p>}
    </div>
  );
}

function ApiKeysPanel({ initial, textProvider, textModel }: { initial: AiProviderSettingsView; textProvider: string; textModel: string }) {
  const router = useRouter();
  const [keys, setKeys] = useState(initial.keys);

  return (
    <div className="pt-6 mt-6 border-t border-border space-y-3">
      <h3 className="font-semibold text-foreground">API keys</h3>
      <p className="text-xs text-caption">
        Keys are encrypted before they&apos;re stored and are never shown again, only their last 4 characters. A key entered here takes priority over the
        server&apos;s environment variable; remove it to fall back to the environment variable. Test connection sends one tiny real request (billed by the
        provider) using the model selected above for that provider, or its default model.
      </p>
      {!initial.keyStoreAvailable && (
        <p className="text-sm text-yellow-700 dark:text-yellow-400">
          Keys can&apos;t be stored yet: the add_ai_provider_keys database migration hasn&apos;t been applied. Environment-variable keys still work.
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {keys.map((status) => (
          <KeyRow
            key={status.provider}
            status={status}
            disabled={!initial.keyStoreAvailable}
            testModel={status.provider === textProvider ? textModel : ""}
            onChange={(next) => {
              setKeys((all) => all.map((k) => (k.provider === next.provider ? next : k)));
              router.refresh(); // re-evaluates which providers can be selected
            }}
          />
        ))}
      </div>
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
    try {
      setMessage(null);
      const result = await saveAiProviderSettings({ textProvider: textProvider || null, textModel, imageProvider: imageProvider || null, imageModel });
      if (result.success) {
        setMessage({ ok: true, text: "Saved. The next AI call uses this selection — no redeploy needed." });
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.error });
      }
    } catch (err) {
      setMessage({ ok: false, text: describeActionError(err) });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      setMessage(null);
      const provider = textProvider || initial.env.textProvider;
      const result = await testAiProviderConnection({ provider, model: textProvider ? textModel : "" });
      setMessage(
        result.success
          ? { ok: true, text: `${label(provider)} (${result.data.model}) responded in ${result.data.latencyMs} ms.` }
          : { ok: false, text: `${label(provider)} test failed: ${result.error}` }
      );
    } catch (err) {
      setMessage({ ok: false, text: describeActionError(err) });
    } finally {
      setTesting(false);
    }
  };

  const { text, image } = initial.active;

  return (
    <div id="ai-provider" className="bg-card p-6 rounded-xl shadow-sm border border-border scroll-mt-6">
      <h2 className="text-xl font-bold text-foreground mb-2">AI Provider</h2>
      <p className="text-sm text-caption mb-4">
        Which AI service the content pipeline calls. Changes apply to the next AI call. A provider needs an API key before it can be selected: enter
        one under API keys below (stored encrypted; it overrides the server&apos;s environment variable), or set its environment variable.
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

      <ApiKeysPanel initial={initial} textProvider={textProvider} textModel={textModel} />

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
