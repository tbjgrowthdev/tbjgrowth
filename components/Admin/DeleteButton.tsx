"use client";
import { confirmDialog } from "@/lib/admin/dialog";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { DeleteOptions, DependencyFinding } from "@/lib/dependency-check";
import { toast } from "@/lib/admin/toast";
import { describeActionError } from "@/lib/admin/action-errors";

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
    if (await confirmDialog({ title: `Delete this ${entityName}?`, text: "This action cannot be undone.", confirmText: "Delete", danger: true })) {
      setIsDeleting(true);
      try {
        let result = await onDelete(id);
        if (result && result.success === false && result.dependencies?.length) {
          const list = result.dependencies.map((d) => `• ${d.description}`).join("\n");
          const count = result.dependencies.length;
          if (!(await confirmDialog({ title: "Delete anyway?", text: `This ${entityName} is still referenced in ${count} place(s):

${list}`, confirmText: "Delete anyway", danger: true }))) return;
          result = await onDelete(id, { force: true });
        }
        if (result && result.success === false) {
          toast.error(`Couldn't delete ${entityName}`, result.error ? { description: result.error } : undefined);
        } else {
          toast.success(`${entityName.charAt(0).toUpperCase() + entityName.slice(1)} deleted`);
        }
      } catch (error) {
        console.error(`Failed to delete ${entityName}`, error);
        toast.error(`Couldn't delete ${entityName}`, { description: describeActionError(error, "The request failed") });
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
