"use client";

import { useState } from "react";
import { checkTlsCertificate } from "@/app/(admin)/actions/technical";
import { ShieldCheck, ShieldAlert, PlayCircle } from "lucide-react";

export default function SslChecker() {
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof checkTlsCertificate>> | null>(null);

  const runCheck = async () => {
    setIsChecking(true);
    const res = await checkTlsCertificate();
    setResult(res);
    setIsChecking(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">SSL Certificate</h3>
        <button
          onClick={runCheck}
          disabled={isChecking}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
        >
          <PlayCircle size={14} />
          {isChecking ? "Checking..." : "Check Now"}
        </button>
      </div>

      {!result && <p className="text-xs text-gray-500 dark:text-gray-400">Click "Check Now" to verify the live certificate.</p>}

      {result && (
        result.error ? (
          <p className="text-xs text-yellow-600 dark:text-yellow-400">{result.error}</p>
        ) : (
          <div className="flex items-center gap-2">
            {result.valid ? <ShieldCheck size={18} className="text-green-500" /> : <ShieldAlert size={18} className="text-red-500" />}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {result.valid ? "Valid" : "Invalid"} — expires in {result.daysRemaining} day{result.daysRemaining === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {result.expiresAt && new Date(result.expiresAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
}
