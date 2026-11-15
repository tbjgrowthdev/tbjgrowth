import Link from "next/link";
import { getSubscribers, type SubscriberFilters } from "../../actions/newsletter";
import { NEWSLETTER_SOURCES, NEWSLETTER_SOURCE_LABELS, isNewsletterSource } from "@/lib/newsletter";
import PageTitle from "@/components/Admin/PageTitle";
import ExportSubscribersButton from "@/components/Admin/Subscribers/ExportSubscribersButton";
import SubscriberRowActions from "@/components/Admin/Subscribers/SubscriberRowActions";

type SearchParams = Promise<{ source?: string; status?: string; page?: string }>;

function hrefFor(filters: SubscriberFilters) {
  const params = new URLSearchParams();
  if (filters.source) params.set("source", filters.source);
  if (filters.status) params.set("status", filters.status);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const qs = params.toString();
  return qs ? `/admin/subscribers?${qs}` : "/admin/subscribers";
}

function FilterPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
        active
          ? "bg-brand-orange-deep text-white border-brand-orange-deep"
          : "bg-background text-muted border-border hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function SubscribersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filters: SubscriberFilters = {
    source: isNewsletterSource(sp.source) ? sp.source : undefined,
    status: sp.status === "ACTIVE" || sp.status === "UNSUBSCRIBED" ? sp.status : undefined,
    page: Number(sp.page) > 1 ? Math.floor(Number(sp.page)) : 1,
  };
  const { subscribers, matching, page, pageSize, counts } = await getSubscribers(filters);
  const pages = Math.max(1, Math.ceil(matching / pageSize));
  const labelFor = (source: string) => (isNewsletterSource(source) ? NEWSLETTER_SOURCE_LABELS[source] : source);

  const cards = [
    { label: "Active subscribers", value: counts.active },
    ...NEWSLETTER_SOURCES.map((s) => ({ label: `From ${NEWSLETTER_SOURCE_LABELS[s].toLowerCase()}`, value: counts.activeBySource[s] ?? 0 })),
    { label: "Unsubscribed", value: counts.unsubscribed },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <PageTitle>Newsletter Subscribers</PageTitle>
          <p className="text-caption">Signups from the footer and blog newsletter forms.</p>
        </div>
        <ExportSubscribersButton source={filters.source} status={filters.status} disabled={matching === 0} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-card p-4 rounded-lg border border-border">
            <div className="text-2xl font-bold text-foreground tabular-nums">{c.value.toLocaleString()}</div>
            <div className="text-sm text-caption">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Source:</span>
          <FilterPill href={hrefFor({ ...filters, source: undefined, page: 1 })} active={!filters.source}>All</FilterPill>
          {NEWSLETTER_SOURCES.map((s) => (
            <FilterPill key={s} href={hrefFor({ ...filters, source: s, page: 1 })} active={filters.source === s}>
              {NEWSLETTER_SOURCE_LABELS[s]}
            </FilterPill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Status:</span>
          <FilterPill href={hrefFor({ ...filters, status: undefined, page: 1 })} active={!filters.status}>All</FilterPill>
          <FilterPill href={hrefFor({ ...filters, status: "ACTIVE", page: 1 })} active={filters.status === "ACTIVE"}>Active</FilterPill>
          <FilterPill href={hrefFor({ ...filters, status: "UNSUBSCRIBED", page: 1 })} active={filters.status === "UNSUBSCRIBED"}>
            Unsubscribed
          </FilterPill>
        </div>
        <span className="text-sm text-caption">{matching.toLocaleString()} matching</span>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="px-4 py-3 font-semibold text-foreground">Email</th>
                <th className="px-4 py-3 font-semibold text-foreground">Source</th>
                <th className="px-4 py-3 font-semibold text-foreground">Page</th>
                <th className="px-4 py-3 font-semibold text-foreground">Status</th>
                <th className="px-4 py-3 font-semibold text-foreground">Subscribed</th>
                <th className="px-4 py-3 font-semibold text-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subscribers.map((s) => (
                <tr key={s.id} className="hover:bg-background">
                  <td className="px-4 py-3 text-foreground font-medium break-all">{s.email}</td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{labelFor(s.source)}</td>
                  <td className="px-4 py-3 text-caption text-xs">
                    <span className="block truncate max-w-[220px]" title={s.path ?? undefined}>{s.path || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {s.status === "ACTIVE" ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">Active</span>
                    ) : (
                      <span
                        className="px-2 py-0.5 rounded-full text-xs bg-background text-caption border border-border"
                        title={s.unsubscribedAt ? `Unsubscribed ${new Date(s.unsubscribedAt).toLocaleString()}` : undefined}
                      >
                        Unsubscribed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-caption text-xs whitespace-nowrap">{new Date(s.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <SubscriberRowActions id={s.id} email={s.email} status={s.status} />
                  </td>
                </tr>
              ))}
              {subscribers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-caption">
                    {filters.source || filters.status ? "No subscribers match these filters." : "No subscribers yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? (
            <Link href={hrefFor({ ...filters, page: page - 1 })} className="text-brand-orange-deep hover:underline">← Previous</Link>
          ) : <span />}
          <span className="text-caption">Page {page} of {pages}</span>
          {page < pages ? (
            <Link href={hrefFor({ ...filters, page: page + 1 })} className="text-brand-orange-deep hover:underline">Next →</Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
