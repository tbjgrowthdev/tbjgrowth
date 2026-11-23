import Link from "next/link";
import { Paperclip } from "lucide-react";
import { fill, formatDate, formatTime, type PortalLanguage, type PortalStrings } from "@/lib/portal/strings";

type Update = {
  id: string;
  kind: string;
  body: string;
  createdAt: Date | string;
  authorName: string | null;
  attachments: Array<{ id: string; name: string }>;
  projectId?: string;
  projectTitle?: string;
};

/**
 * Project updates, newest first. Attachments download through
 * /api/portal/files/{id}?kind=attachment (session- and client-checked).
 * `showProject` adds the project name (Home's "latest update").
 */
export default function UpdateFeed({ updates, t, language, showProject = false }: { updates: Update[]; t: PortalStrings["projects"]; language: PortalLanguage; showProject?: boolean }) {
  if (updates.length === 0) return <p className="text-sm text-muted">{t.noUpdates}</p>;
  return (
    <ul className="space-y-3">
      {updates.map((u) => (
        <li key={u.id} className="admin-card p-4">
          <p className="text-xs text-muted">
            {showProject && u.projectId ? (
              <>
                <Link href={`/portal/projects/${u.projectId}`} className="font-semibold underline-offset-2 hover:underline">{u.projectTitle}</Link> ·{" "}
              </>
            ) : null}
            {u.kind === "MANUAL" && u.authorName ? u.authorName : t.automatic} · {formatDate(u.createdAt, language)}, {formatTime(u.createdAt, language)}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words">{u.body}</p>
          {u.attachments.length > 0 && (
            <ul className="mt-2 space-y-1">
              {u.attachments.map((a) => (
                <li key={a.id}>
                  <a href={`/api/portal/files/${a.id}?kind=attachment`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--admin-orange-text)] break-all">
                    <Paperclip size={16} aria-hidden="true" /> {fill(t.attachment, { name: a.name })}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
