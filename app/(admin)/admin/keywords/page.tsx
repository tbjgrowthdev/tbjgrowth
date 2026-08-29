import { getTrackedKeywords, getCompetitorDomains } from "@/app/(admin)/actions/keywords";
import KeywordTrackingManager from "@/components/Admin/KeywordTrackingManager";

export default async function KeywordsPage() {
  const [keywords, competitors] = await Promise.all([getTrackedKeywords(), getCompetitorDomains()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Keyword Tracking</h1>
        <p className="text-caption">
          Track UK Google rankings per keyword and monitor competitor domains. Rank checks use DataForSEO and are run on demand.
        </p>
      </div>
      <KeywordTrackingManager keywords={keywords} competitors={competitors} />
    </div>
  );
}
