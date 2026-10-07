"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteMediaAsset } from "@/app/(admin)/actions/media";

export default function MediaDeleteButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = confirm(
      "Deleting this asset doesn't check whether its URL is still used in any post, case study, or page. If it's referenced elsewhere, that image will break.\n\nDelete anyway?"
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const result = await deleteMediaAsset(id);
      if (result.success) {
        onDeleted();
      } else {
        alert(result.error || "Failed to delete asset");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/10 disabled:opacity-50"
    >
      <Trash2 size={16} />
      {isDeleting ? "Deleting..." : "Delete"}
    </button>
  );
}
