"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="admin-nav-item" data-danger="" title="Logout">
      <span className="admin-nav-icon" aria-hidden="true">
        <LogOut size={18} />
      </span>
      <span className="admin-nav-label">Logout</span>
    </button>
  );
}
