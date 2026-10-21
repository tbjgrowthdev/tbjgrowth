"use client";

import { useEffect, useRef, useState } from "react";
import { acquireContentLock, takeOverContentLock, heartbeatContentLock, releaseContentLock } from "@/app/(admin)/actions/content-lock";
import { AlertTriangle, Lock } from "lucide-react";

type ContentKind = "POST" | "PAGE" | "CASE_STUDY" | "SERVICE" | "LOCATION";

const HEARTBEAT_INTERVAL_MS = 30_000;

interface ContentLockBannerProps {
  contentType: ContentKind;
  contentId: string;
  onLockStateChange: (lockedByOther: boolean) => void;
}

export default function ContentLockBanner({ contentType, contentId, onLockStateChange }: ContentLockBannerProps) {
  const [holder, setHolder] = useState<{ name: string | null; email: string | null; acquiredAt: Date } | null>(null);
  const [takingOver, setTakingOver] = useState(false);
  const releasedRef = useRef(false);

  useEffect(() => {
    releasedRef.current = false;

    acquireContentLock(contentType, contentId).then((status) => {
      if (status.locked && !status.byMe) {
        setHolder({ name: status.lockedByName, email: status.lockedByEmail, acquiredAt: new Date(status.acquiredAt) });
        onLockStateChange(true);
      } else {
        setHolder(null);
        onLockStateChange(false);
      }
    });

    const interval = setInterval(() => {
      if (releasedRef.current) return;
      heartbeatContentLock(contentType, contentId).then((status) => {
        if (status.locked && !status.byMe) {
          setHolder({ name: status.lockedByName, email: status.lockedByEmail, acquiredAt: new Date(status.acquiredAt) });
          onLockStateChange(true);
        }
      });
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (!releasedRef.current) {
        releasedRef.current = true;
        releaseContentLock(contentType, contentId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, contentId]);

  const handleTakeOver = async () => {
    setTakingOver(true);
    try {
      const status = await takeOverContentLock(contentType, contentId);
      if (status.locked && status.byMe) {
        setHolder(null);
        onLockStateChange(false);
      }
    } finally {
      setTakingOver(false);
    }
  };

  if (!holder) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
      <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
          <Lock size={14} />
          This content is currently being edited by another user.
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
          {holder.name || holder.email || "Someone"} started editing at {holder.acquiredAt.toLocaleTimeString()}. Changes you make here may be lost if they save first.
        </p>
      </div>
      <button
        type="button"
        onClick={handleTakeOver}
        disabled={takingOver}
        className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 disabled:opacity-50 flex-shrink-0"
      >
        {takingOver ? "Taking over..." : "Take Over Editing"}
      </button>
    </div>
  );
}
