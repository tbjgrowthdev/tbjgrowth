"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Link2, Menu, FileText, Code2, Route, Languages } from "lucide-react";
import { checkContentDependencies } from "@/app/(admin)/actions/dependencies";
import type { ContentKind, DependencyCategory } from "@/lib/dependency-check";

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
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
  entityName?: string;
}

export default function ContentDeleteButton({ id, kind, onDelete, entityName = "item" }: ContentDeleteButtonProps) {
  const [checking, setChecking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [findings, setFindings] = useState<{ category: DependencyCategory; description: string }[] | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleClick = async () => {
    setChecking(true);
    try {
      const results = await checkContentDependencies(kind, id);
      setFindings(results);
      setShowModal(true);
    } finally {
      setChecking(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      const result = await onDelete(id);
      if (!result.success) {
        alert(result.error || `Failed to delete ${entityName}`);
      }
      setShowModal(false);
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
