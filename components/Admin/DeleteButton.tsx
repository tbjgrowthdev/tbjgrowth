"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { DeleteOptions, DependencyFinding } from "@/lib/dependency-check";

type DeleteResult = { success?: boolean; error?: string; dependencies?: DependencyFinding[] } | void | null | undefined;

interface DeleteButtonProps {
  id: string;
  // Actions that check dependencies (see lib/dependency-check.ts) return them
  // with success: false; this asks again and retries with { force: true }.
  onDelete: (id: string, options?: DeleteOptions) => Promise<DeleteResult>;
  entityName?: string;
}

export default function DeleteButton({ id, onDelete, entityName = "item" }: DeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete this ${entityName}? This action cannot be undone.`)) {
      setIsDeleting(true);
      try {
        let result = await onDelete(id);
        if (result && result.success === false && result.dependencies?.length) {
          const list = result.dependencies.map((d) => `• ${d.description}`).join("\n");
          const count = result.dependencies.length;
          if (!confirm(`This ${entityName} is still referenced in ${count} place(s):\n\n${list}\n\nDelete anyway?`)) return;
          result = await onDelete(id, { force: true });
        }
        if (result && result.success === false) {
          alert(result.error || `Failed to delete ${entityName}.`);
        }
      } catch (error) {
        console.error(`Failed to delete ${entityName}`, error);
        alert(`Failed to delete ${entityName}.`);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <button 
      onClick={handleDelete}
      disabled={isDeleting}
      className={`text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 ${isDeleting ? "opacity-50 cursor-not-allowed" : ""}`}
      title={`Delete ${entityName}`}
    >
      <Trash2 size={18} />
    </button>
  );
}
