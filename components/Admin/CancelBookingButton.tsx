"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelBooking } from "@/app/(admin)/actions/booking";
import { XCircle } from "lucide-react";
import { withToast } from "@/lib/admin/toast";

export default function CancelBookingButton({ id }: { id: string }) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);

  const handleClick = async () => {
    if (!confirm("Cancel this booking? The slot will become available again.")) return;
    setIsCancelling(true);
    await withToast(cancelBooking(id), { success: "Booking cancelled", error: "Couldn't cancel booking" });
    router.refresh();
    setIsCancelling(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isCancelling}
      className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 ml-auto"
    >
      <XCircle size={14} />
      {isCancelling ? "Cancelling..." : "Cancel"}
    </button>
  );
}
