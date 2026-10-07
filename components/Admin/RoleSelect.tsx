"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  EDITOR: "Editor",
  SEO_MANAGER: "SEO Manager",
  CONTRIBUTOR: "Contributor",
};

interface RoleSelectProps {
  id: string;
  role: Role;
  assignableRoles: Role[];
  onChange: (id: string, role: Role) => Promise<{ success: boolean; error?: string }>;
}

export default function RoleSelect({ id, role, assignableRoles, onChange }: RoleSelectProps) {
  const [value, setValue] = useState(role);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as Role;
    const previous = value;
    setValue(newRole);
    setIsSaving(true);
    try {
      const result = await onChange(id, newRole);
      if (!result.success) {
        setValue(previous);
        alert(result.error || "Failed to update role");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Not managed by the acting user (role not in assignableRoles) — show as
  // read-only text instead of a dropdown they can't actually use.
  if (!assignableRoles.includes(role)) {
    return <span className="text-sm text-caption">{ROLE_LABELS[role]}</span>;
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={isSaving}
      className="px-2.5 py-1 rounded-lg border border-border bg-background text-foreground text-xs font-medium disabled:opacity-50"
    >
      {assignableRoles.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}
