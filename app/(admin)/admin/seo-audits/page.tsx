import { getSeoAuditData } from "@/app/(admin)/actions/seo-audits";
import SeoAuditsClient from "@/components/Admin/SeoAuditsClient";

export default async function SeoAuditsPage() {
  const { latest, history } = await getSeoAuditData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Automated SEO Audits</h1>
        <p className="text-caption">
          Scheduled crawl across 14 categories: missing/duplicate title &amp; meta, missing/multiple H1, canonical errors, noindex
          issues, broken links, orphan pages, redirect problems, schema problems, thin content, and missing alt text.
        </p>
      </div>
      <SeoAuditsClient latest={latest} history={history} />
    </div>
  );
}
