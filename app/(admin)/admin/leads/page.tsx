import Link from "next/link";
import { getLeads } from "../../actions/forms";
import { prisma } from "@/lib/prisma";
import { Mail, Phone, Building, CheckCircle2 } from "lucide-react";
import MarkReadButton from "@/components/Admin/MarkReadButton";
import LeadReplyBox from "@/components/Admin/LeadReplyBox";
import PageTitle from "@/components/Admin/PageTitle";

type Filter = "all" | "unanswered" | "answered";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unanswered", label: "Not replied" },
  { value: "answered", label: "Replied" },
];

export default async function LeadsList({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const sp = await searchParams;
  const filter: Filter = sp.filter === "unanswered" || sp.filter === "answered" ? sp.filter : "all";
  // The page is behind the same USER_MANAGEMENT gate as getLeads (middleware).
  const [leads, settings] = await Promise.all([getLeads(filter), prisma.siteSetting.findFirst({ select: { email: true } })]);
  const inbox = settings?.email?.trim() || null;

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <PageTitle>Lead Captures & Forms</PageTitle>
        <div className="flex items-center gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value === "all" ? "/admin/leads" : `/admin/leads?filter=${f.value}`}
              aria-current={filter === f.value ? "page" : undefined}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                filter === f.value
                  ? "bg-brand-orange-deep text-white border-brand-orange-deep"
                  : "bg-background text-muted border-border hover:text-foreground"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {leads.length === 0 ? (
          <div className="bg-card p-8 rounded-lg text-center text-caption border border-border">
            {filter === "all" ? "No leads received yet." : filter === "unanswered" ? "Every lead has a reply." : "No leads have been replied to yet."}
          </div>
        ) : (
          leads.map((lead) => {
            const replied = lead.replies.length > 0;
            return (
              <div key={lead.id} className={`bg-card p-6 rounded-lg shadow-sm border ${lead.isRead ? 'border-border' : 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-400'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground flex flex-wrap items-center gap-2">
                      {lead.name}
                      {!lead.isRead && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">New</span>}
                      {replied && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-xs rounded-full font-medium">
                          <CheckCircle2 size={12} />
                          Replied{lead.replies.length > 1 ? ` ×${lead.replies.length}` : ""}
                        </span>
                      )}
                    </h3>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted">
                      <span className="flex items-center gap-1"><Mail size={14} /> {lead.email}</span>
                      {lead.phone && <span className="flex items-center gap-1"><Phone size={14} /> {lead.phone}</span>}
                      {lead.company && <span className="flex items-center gap-1"><Building size={14} /> {lead.company}</span>}
                    </div>
                  </div>
                  <div className="text-xs text-caption">
                    {new Date(lead.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="bg-background p-4 rounded text-sm text-muted whitespace-pre-wrap">
                  {lead.message}
                </div>

                {replied && (
                  <div className="mt-4 space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-caption">Replies</h4>
                    {lead.replies.map((r) => (
                      <div key={r.id} className="border-l-2 border-brand-orange/60 pl-4">
                        <div className="text-xs text-caption mb-1">
                          <span className="font-medium text-foreground">{r.sentByName || r.sentByEmail || "An admin"}</span>
                          {" · "}
                          {new Date(r.createdAt).toLocaleString()}
                        </div>
                        <div className="text-sm text-muted whitespace-pre-wrap">{r.body}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-caption">Source: {lead.source}</span>
                  <div className="flex items-center gap-4">
                    {!lead.isRead && <MarkReadButton id={lead.id} />}
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <LeadReplyBox
                    leadId={lead.id}
                    leadName={lead.name}
                    leadEmail={lead.email}
                    inbox={inbox}
                    hasReplies={replied}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
