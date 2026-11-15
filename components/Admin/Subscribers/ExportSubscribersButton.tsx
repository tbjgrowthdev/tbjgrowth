"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { exportSubscribersCsv } from "@/app/(admin)/actions/newsletter";
import { withToast } from "@/lib/admin/toast";

/** Downloads every subscriber matching the current filters (all pages) as CSV. */
export default function ExportSubscribersButton({
  source,
  status,
  disabled,
}: {
  source?: string;
  status?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const result = await withToast(exportSubscribersCsv({ source, status }), {
        success: null,
        error: "Couldn't export subscribers",
      });
      if (!result.success) return;
      // BOM so Excel opens it as UTF-8.
      const blob = new Blob(["﻿" + result.data], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `newsletter-subscribers${source ? `-${source}` : ""}${status ? `-${status.toLowerCase()}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // withToast already showed the error.
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || disabled}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
    >
      <Download size={16} />
      {busy ? "Exporting..." : "Export CSV"}
    </button>
  );
}
