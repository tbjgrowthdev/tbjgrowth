"use client";

import { useState } from "react";
import { checkTlsCertificate } from "@/app/(admin)/actions/technical";
import { ShieldCheck, ShieldAlert, PlayCircle, TriangleAlert } from "lucide-react";
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
    <section className="admin-card flex flex-col p-6" aria-labelledby="ssl-title">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-stat text-brand-orange-deep dark:text-brand-orange-light">
            <ShieldCheck size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">Security</p>
            <h3 id="ssl-title" className="font-heading text-lg font-bold leading-tight tracking-tight text-foreground">
              SSL Certificate
            </h3>
          </div>
        </div>
        <button type="button" onClick={runCheck} disabled={isChecking} className="btn-secondary !px-3.5 !py-1.5 !text-xs disabled:opacity-60">
          <PlayCircle size={14} aria-hidden="true" />
          {isChecking ? "Checking..." : "Check Now"}
        </button>
      </div>

      <div className="mt-5 flex-1">
        {actionError && (
          <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
            <TriangleAlert size={16} className="mt-0.5 flex-none" aria-hidden="true" />
            {actionError}
          </p>
        )}
        {!result && !actionError && <p className="text-sm text-caption">Click &quot;Check Now&quot; to verify the live certificate.</p>}

        {result &&
          (result.error ? (
            <p className="flex items-start gap-2 text-sm font-semibold text-yellow-700 dark:text-yellow-400">
              <TriangleAlert size={16} className="mt-0.5 flex-none" aria-hidden="true" />
              {result.error}
            </p>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--admin-inset)] p-3.5">
              {result.valid ? (
                <ShieldCheck size={22} className="flex-none text-green-700 dark:text-green-400" aria-hidden="true" />
              ) : (
                <ShieldAlert size={22} className="flex-none text-red-700 dark:text-red-400" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-bold text-foreground">
                  {result.valid ? "Valid" : "Invalid"} — expires in {result.daysRemaining} day{result.daysRemaining === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-caption">{result.expiresAt && new Date(result.expiresAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
