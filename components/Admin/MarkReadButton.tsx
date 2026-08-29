"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markLeadAsRead } from "@/app/(admin)/actions/forms";
import { CheckCheck } from "lucide-react";

export default function MarkReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [isMarking, setIsMarking] = useState(false);

  const handleClick = async () => {
    setIsMarking(true);
    await markLeadAsRead(id);
    router.refresh();
    setIsMarking(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isMarking}
      className="flex items-center gap-1.5 text-xs font-medium text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light dark:hover:text-brand-orange disabled:opacity-50"
    >
      <CheckCheck size={14} />
      {isMarking ? "Marking..." : "Mark as read"}
    </button>
  );
}
