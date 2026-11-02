"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Link2, Menu, FileText, Code2, Route, Languages } from "lucide-react";
import { checkContentDependencies } from "@/app/(admin)/actions/dependencies";
import { toast } from "@/lib/admin/toast";
import { describeActionError } from "@/lib/admin/action-errors";
import type { ContentKind, DeleteOptions, DependencyCategory, DependencyFinding } from "@/lib/dependency-check";

const CATEGORY_ICON: Record<DependencyCategory, typeof Link2> = {
  "Internal Links": Link2,
  Menus: Menu,
  "Related Content": FileText,
  "Schema References": Code2,
  Redirects: Route,
  Translations: Languages,
};

interface ContentDeleteButtonProps {
  id: string;
  kind: ContentKind;
  // The delete actions block when dependencies exist and return them; this
  // component passes { force: true } once the user has seen them and confirmed.
  onDelete: (id: string, options?: DeleteOptions) => Promise<{ success: boolean; error?: string; dependencies?: DependencyFinding[] }>;
  entityName?: string;
}

export default function ContentDeleteButton({ id, kind, onDelete, entityName = "item" }: ContentDeleteButtonProps) {
  const [checking, setChecking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [findings, setFindings] = useState<DependencyFinding[] | null>(null);
  const [showModal, setShowModal] = useState(false);
  // Set when the server found references the pre-check didn't show.
  const [changedSinceCheck, setChangedSinceCheck] = useState(false);

  const handleClick = async () => {
    setChecking(true);
    try {
      const results = await checkContentDependencies(kind, id);
      setFindings(results);
      setChangedSinceCheck(false);
      setShowModal(true);
    } catch (error) {
      toast.error("Couldn't check what links to this", { description: describeActionError(error, "The request failed") });
    } finally {
      setChecking(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      // Force only when the user was shown a non-empty list and clicked "Delete Anyway".
      const result = await onDelete(id, findings && findings.length > 0 ? { force: true } : undefined);
      if (!result.success && result.dependencies?.length) {
        // The server found references this dialog didn't show (e.g. a link added
        // after it opened). Show them and let the user decide again.
        setFindings(result.dependencies);
        setChangedSinceCheck(true);
        return;
      }
      if (!result.success) {
        toast.error(`Couldn't delete ${entityName}`, result.error ? { description: result.error } : undefined);
      } else {
        toast.success(`${entityName.charAt(0).toUpperCase() + entityName.slice(1)} deleted`);
      }
      setShowModal(false);
    } catch (error) {
      toast.error(`Couldn't delete ${entityName}`, { description: describeActionError(error, "The request failed") });
    } finally {
      setDeleting(false);
    }
  };

  const grouped = findings?.reduce<Record<string, string[]>>((acc, f) => {
    (acc[f.category] ||= []).push(f.description);
    return acc;
  }, {});

  return (
    <>
      <button
        onClick={handleClick}
        disabled={checking}
        className={`text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 ${checking ? "opacity-50 cursor-not-allowed" : ""}`}
        title={`Delete ${entityName}`}
      >
        <Trash2 size={18} />
      </button>

      {showModal && findings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl border border-border max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} className={findings.length > 0 ? "text-amber-500" : "text-caption"} />
              <h2 className="text-lg font-semibold text-foreground">
                {findings.length > 0 ? `${findings.length} thing${findings.length > 1 ? "s" : ""} reference this ${entityName}` : `Delete this ${entityName}?`}
              </h2>
            </div>

            {findings.length === 0 ? (
              <p className="text-sm text-caption">
                No internal links, menu entries, schema references, or redirects currently point to this {entityName}. Safe to delete.
              </p>
            ) : (
              <>
                {changedSinceCheck && (
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    This list changed since you opened this dialog. Review it again before deleting.
                  </p>
                )}
                <p className="text-sm text-caption">
                  Deleting this {entityName} may break the following. Review before continuing:
                </p>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {Object.entries(grouped || {}).map(([category, descriptions]) => {
                    const Icon = CATEGORY_ICON[category as DependencyCategory];
                    return (
                      <div key={category} className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <Icon size={14} />
                          {category} ({descriptions.length})
                        </div>
                        <ul className="space-y-0.5 pl-5">
                          {descriptions.map((d, i) => (
                            <li key={i} className="text-xs text-caption list-disc">{d}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-background text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
              >
                {deleting ? "Deleting..." : findings.length > 0 ? "Delete Anyway" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
