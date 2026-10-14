"use client";

import { useState } from "react";
import {
  beginTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
  regenerateBackupCodes,
  revokeMySession,
  revokeAllOtherSessions,
} from "@/app/(admin)/actions/security";
import { ShieldCheck, ShieldOff, Smartphone, AlertCircle, CheckCircle2, Monitor, LogOut, History } from "lucide-react";

type AdminSession = {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string | Date;
  lastSeenAt: string | Date;
};

type LoginAttempt = {
  id: string;
  success: boolean;
  ip: string | null;
  createdAt: string | Date;
};

// Loose, good-enough device label from the user-agent string — not trying
// to be a full UA parser, just enough for someone to recognize "that's my
// laptop" vs "I don't recognize this."
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  if (/iphone/i.test(userAgent)) return "iPhone";
  if (/ipad/i.test(userAgent)) return "iPad";
  if (/android/i.test(userAgent)) return "Android device";
  if (/windows/i.test(userAgent)) return "Windows";
  if (/macintosh|mac os/i.test(userAgent)) return "Mac";
  if (/linux/i.test(userAgent)) return "Linux";
  return "Unknown device";
}

export default function SecuritySettings({
  initialTwoFactorEnabled,
  initialSessions,
  currentSessionId,
  initialLoginHistory,
}: {
  initialTwoFactorEnabled: boolean;
  initialSessions: AdminSession[];
  currentSessionId: string | undefined;
  initialLoginHistory: LoginAttempt[];
}) {
  return (
    <div className="space-y-6">
      <TwoFactorCard initialEnabled={initialTwoFactorEnabled} />
      <SessionsCard initialSessions={initialSessions} currentSessionId={currentSessionId} />
      <LoginHistoryCard attempts={initialLoginHistory} />
    </div>
  );
}

function TwoFactorCard({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<"idle" | "setup" | "backupCodes" | "disable" | "regenerate">("idle");
  const [qrSvg, setQrSvg] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep("idle");
    setCode("");
    setPassword("");
    setError(null);
  };

  const startSetup = async () => {
    setBusy(true);
    setError(null);
    const result = await beginTwoFactorSetup();
    setBusy(false);
    if (!result.success) {
      setError(result.error || "Failed to start setup");
      return;
    }
    setQrSvg(result.qrSvg!);
    setSecret(result.secret!);
    setStep("setup");
  };

  const confirmSetup = async () => {
    setBusy(true);
    setError(null);
    const result = await confirmTwoFactorSetup(code);
    setBusy(false);
    if (!result.success) {
      setError(result.error || "Failed to confirm setup");
      return;
    }
    setBackupCodes(result.backupCodes!);
    setEnabled(true);
    setStep("backupCodes");
  };

  const handleDisable = async () => {
    setBusy(true);
    setError(null);
    const result = await disableTwoFactor(password);
    setBusy(false);
    if (!result.success) {
      setError(result.error || "Failed to disable");
      return;
    }
    setEnabled(false);
    reset();
  };

  const handleRegenerate = async () => {
    setBusy(true);
    setError(null);
    const result = await regenerateBackupCodes(password);
    setBusy(false);
    if (!result.success) {
      setError(result.error || "Failed to regenerate codes");
      return;
    }
    setBackupCodes(result.backupCodes!);
    setStep("backupCodes");
  };

  return (
    <div className="bg-card p-6 rounded-xl shadow-sm border border-border space-y-4">
      <div className="flex items-center gap-2">
        {enabled ? <ShieldCheck size={20} className="text-green-500" /> : <ShieldOff size={20} className="text-caption" />}
        <h2 className="text-xl font-bold text-foreground">Two-Factor Authentication</h2>
      </div>
      <p className="text-sm text-caption">
        {enabled
          ? "Enabled — an authenticator app code is required in addition to your password."
          : "Add an authenticator app (Google Authenticator, 1Password, Authy, etc.) as a second sign-in step."}
      </p>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {step === "idle" && (
        <div className="flex gap-2">
          {!enabled ? (
            <button onClick={startSetup} disabled={busy} className="px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50">
              Enable two-factor authentication
            </button>
          ) : (
            <>
              <button onClick={() => setStep("regenerate")} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-tint transition-colors">
                Regenerate backup codes
              </button>
              <button onClick={() => setStep("disable")} className="px-4 py-2 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                Disable
              </button>
            </>
          )}
        </div>
      )}

      {step === "setup" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="bg-white p-2 rounded-lg inline-block" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <div className="text-sm space-y-2">
              <p className="text-caption">Scan this with your authenticator app, or enter the code manually:</p>
              <p className="font-mono text-xs bg-tint px-2 py-1 rounded break-all">{secret}</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">Enter the 6-digit code to confirm</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              className="w-full max-w-xs px-3 py-2 bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-brand-orange"
              placeholder="123456"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={confirmSetup} disabled={busy || !code} className="px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50">
              Confirm & enable
            </button>
            <button onClick={reset} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-tint transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "backupCodes" && (
        <div className="space-y-3">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>Save these backup codes now — each works once if you lose access to your authenticator app. They won&apos;t be shown again.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-tint p-4 rounded-lg">
            {backupCodes.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
          <button onClick={reset} className="px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors">
            I&apos;ve saved these codes
          </button>
        </div>
      )}

      {(step === "disable" || step === "regenerate") && (
        <div className="space-y-3 max-w-sm">
          <label className="block text-sm font-medium text-muted mb-1.5">Confirm your password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-brand-orange"
          />
          <div className="flex gap-2">
            <button
              onClick={step === "disable" ? handleDisable : handleRegenerate}
              disabled={busy || !password}
              className="px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
            >
              Confirm
            </button>
            <button onClick={reset} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-tint transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SessionsCard({
  initialSessions,
  currentSessionId,
}: {
  initialSessions: AdminSession[];
  currentSessionId: string | undefined;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleRevoke = async (id: string) => {
    setBusyId(id);
    const result = await revokeMySession(id);
    setBusyId(null);
    if (result.success) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const handleRevokeAllOthers = async () => {
    setBusyId("all");
    const result = await revokeAllOtherSessions();
    setBusyId(null);
    if (result.success) {
      setSessions((prev) => prev.filter((s) => s.id === currentSessionId));
    }
  };

  return (
    <div className="bg-card p-6 rounded-xl shadow-sm border border-border space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor size={20} className="text-caption" />
          <h2 className="text-xl font-bold text-foreground">Active Sessions</h2>
        </div>
        {sessions.length > 1 && (
          <button
            onClick={handleRevokeAllOthers}
            disabled={busyId === "all"}
            className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
          >
            Sign out all other sessions
          </button>
        )}
      </div>
      <div className="space-y-2">
        {sessions.map((s) => {
          const isCurrent = s.id === currentSessionId;
          return (
            <div key={s.id} className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg">
              <div className="flex items-center gap-3 min-w-0">
                <Smartphone size={18} className="text-caption flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {describeDevice(s.userAgent)} {isCurrent && <span className="text-green-500 text-xs font-normal">(this device)</span>}
                  </p>
                  <p className="text-xs text-caption truncate">
                    {s.ip || "Unknown IP"} · last active {new Date(s.lastSeenAt).toLocaleString()}
                  </p>
                </div>
              </div>
              {!isCurrent && (
                <button
                  onClick={() => handleRevoke(s.id)}
                  disabled={busyId === s.id}
                  className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 flex-shrink-0"
                >
                  <LogOut size={14} />
                  Revoke
                </button>
              )}
            </div>
          );
        })}
        {sessions.length === 0 && <p className="text-sm text-caption">No active sessions.</p>}
      </div>
    </div>
  );
}

function LoginHistoryCard({ attempts }: { attempts: LoginAttempt[] }) {
  return (
    <div className="bg-card p-6 rounded-xl shadow-sm border border-border space-y-4">
      <div className="flex items-center gap-2">
        <History size={20} className="text-caption" />
        <h2 className="text-xl font-bold text-foreground">Recent Login History</h2>
      </div>
      {attempts.length === 0 ? (
        <p className="text-sm text-caption">No login history yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {attempts.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                {a.success ? (
                  <CheckCircle2 size={14} className="text-green-500" />
                ) : (
                  <AlertCircle size={14} className="text-red-500" />
                )}
                <span className="text-foreground">{a.success ? "Successful sign-in" : "Failed attempt"}</span>
              </div>
              <span className="text-caption text-xs">
                {a.ip ? `${a.ip} · ` : ""}
                {new Date(a.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
