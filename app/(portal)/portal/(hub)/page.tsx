import { FolderKanban } from "lucide-react";
import { requireClientPage } from "@/lib/portal/page-guard";
import { portalStrings } from "@/lib/portal/strings";

// Home. Placeholder until Task 8 fills it with projects, approvals, the next
// meeting and the latest update (via lib/portal/data.ts).
export default async function PortalHomePage() {
  const ctx = await requireClientPage();
  const t = portalStrings(ctx.language).home;
  return (
    <div className="space-y-4">
      <h1 className="admin-title text-2xl">{t.welcome}</h1>
      <section className="admin-card flex flex-col items-center gap-3 px-6 py-10 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--tint-bg)] text-[var(--admin-orange-text)]">
          <FolderKanban size={24} aria-hidden="true" />
        </span>
        <h2 className="text-lg font-bold">{t.emptyTitle}</h2>
        <p className="max-w-sm text-sm text-muted">{t.emptyBody}</p>
      </section>
    </div>
  );
}
