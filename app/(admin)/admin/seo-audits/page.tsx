import { getSeoAuditData } from "@/app/(admin)/actions/seo-audits";
import SeoAuditsClient from "@/components/Admin/SeoAuditsClient";
import PageTitle from "@/components/Admin/PageTitle";

export default async function SeoAuditsPage() {
  const { latest, history } = await getSeoAuditData();

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Automated SEO Audits</PageTitle>
        <p className="text-caption">
          Scheduled crawl across 14 categories: missing/duplicate title &amp; meta, missing/multiple H1, canonical errors, noindex
          issues, broken links, orphan pages, redirect problems, schema problems, thin content, and missing alt text.
        </p>
      </div>
      <SeoAuditsClient latest={latest} history={history} />
    </div>
  );
}
