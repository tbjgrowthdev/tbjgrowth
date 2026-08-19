"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

interface DeleteButtonProps {
  id: string;
  onDelete: (id: string) => Promise<any>;
  entityName?: string;
}

export default function DeleteButton({ id, onDelete, entityName = "item" }: DeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete this ${entityName}? This action cannot be undone.`)) {
      setIsDeleting(true);
      try {
        await onDelete(id);
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
