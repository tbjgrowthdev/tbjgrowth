"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteAuditLog } from "@/app/(admin)/actions/audit";

export default function AuditLogDeleteButton({ id }: { id: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Permanently delete this audit log entry? This cannot be undone.")) return;
    setIsDeleting(true);
    try {
      const result = await deleteAuditLog(id);
      if (!result.success) {
        alert(result.error || "Failed to delete entry");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
      title="Delete entry (Super Admin only)"
    >
      <Trash2 size={16} />
    </button>
  );
}
