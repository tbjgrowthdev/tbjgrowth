"use client";

import { useState } from "react";
import { checkTlsCertificate } from "@/app/(admin)/actions/technical";
import { ShieldCheck, ShieldAlert, PlayCircle } from "lucide-react";
import { describeActionError } from "@/lib/admin/action-errors";

export default function SslChecker() {
  const [isChecking, setIsChecking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof checkTlsCertificate>> | null>(null);

  const runCheck = async () => {
    setIsChecking(true);
    try {
      setActionError(null);
      const res = await checkTlsCertificate();
      setResult(res);
    } catch (err) {
      setActionError(describeActionError(err, "Certificate check failed"));
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">SSL Certificate</h3>
        <button
          onClick={runCheck}
          disabled={isChecking}
          className="flex items-center gap-1.5 text-xs text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light dark:hover:text-brand-orange disabled:opacity-50"
        >
          <PlayCircle size={14} />
          {isChecking ? "Checking..." : "Check Now"}
        </button>
      </div>

      {actionError && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-2">{actionError}</p>}
      {!result && <p className="text-xs text-caption">Click "Check Now" to verify the live certificate.</p>}

      {result && (
        result.error ? (
          <p className="text-xs text-yellow-600 dark:text-yellow-400">{result.error}</p>
        ) : (
          <div className="flex items-center gap-2">
            {result.valid ? <ShieldCheck size={18} className="text-green-500" /> : <ShieldAlert size={18} className="text-red-500" />}
            <div>
              <p className="text-sm font-medium text-foreground">
                {result.valid ? "Valid" : "Invalid"} — expires in {result.daysRemaining} day{result.daysRemaining === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-caption">
                {result.expiresAt && new Date(result.expiresAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
}
