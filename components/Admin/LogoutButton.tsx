"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { unregisterPushDevice } from "@/app/(admin)/actions/push";
import { unregisterCurrentDevice } from "@/lib/native";

export function LogoutButton() {
  const logout = async () => {
    // In the TBJ Admin app: stop this phone's notifications before the
    // session ends (no-op on the web). lib/auth.ts's signOut event is the backstop.
    await unregisterCurrentDevice(unregisterPushDevice);
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <button type="button" onClick={logout} className="admin-nav-item" data-danger="" title="Logout">
      <span className="admin-nav-icon" aria-hidden="true">
        <LogOut size={18} />
      </span>
      <span className="admin-nav-label">Logout</span>
    </button>
  );
}
