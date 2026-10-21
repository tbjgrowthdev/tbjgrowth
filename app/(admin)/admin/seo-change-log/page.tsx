import { getSeoChangeLogAction } from "../../actions/seo-change-log";
import SeoChangeLogClient from "@/components/Admin/SeoChangeLogClient";

export default async function SeoChangeLogPage() {
  const entries = await getSeoChangeLogAction();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">SEO Change Impact</h1>
        <p className="text-caption">
          Every significant SEO field change — title, meta description, canonical URL, indexability, schema, and more — with before/after
          performance from Search Console and GA4.
        </p>
      </div>
      <SeoChangeLogClient entries={entries} />
    </div>
  );
}
