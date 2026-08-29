import { getLeads } from "../../actions/forms";
import { Mail, Phone, Building } from "lucide-react";
import MarkReadButton from "@/components/Admin/MarkReadButton";

export default async function LeadsList() {
  const leads = await getLeads();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Lead Captures & Forms</h1>
      </div>

      <div className="space-y-4">
        {leads.length === 0 ? (
          <div className="bg-card p-8 rounded-lg text-center text-caption border border-border">
            No leads received yet.
          </div>
        ) : (
          leads.map((lead) => (
            <div key={lead.id} className={`bg-card p-6 rounded-lg shadow-sm border ${lead.isRead ? 'border-border' : 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-400'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    {lead.name}
                    {!lead.isRead && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">New</span>}
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

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-caption">Source: {lead.source}</span>
                {!lead.isRead && <MarkReadButton id={lead.id} />}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
