import { getSeoChangeLogAction } from "../../actions/seo-change-log";
import SeoChangeLogClient from "@/components/Admin/SeoChangeLogClient";
import PageTitle from "@/components/Admin/PageTitle";

export default async function SeoChangeLogPage() {
  const entries = await getSeoChangeLogAction();

  return (
    <div>
      <div className="mb-6">
        <PageTitle>SEO Change Impact</PageTitle>
        <p className="text-caption">
          Every significant SEO field change — title, meta description, canonical URL, indexability, schema, and more — with before/after
          performance from Search Console and GA4.
        </p>
      </div>
      <SeoChangeLogClient entries={entries} />
    </div>
  );
}
