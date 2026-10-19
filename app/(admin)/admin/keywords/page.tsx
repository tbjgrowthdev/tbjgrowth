import { getTrackedKeywords, getCompetitorDomains } from "@/app/(admin)/actions/keywords";
import { findKeywordIntentConflicts } from "@/lib/keyword-mapping";
import KeywordTrackingManager from "@/components/Admin/KeywordTrackingManager";

export default async function KeywordsPage() {
  const [keywords, competitors] = await Promise.all([getTrackedKeywords(), getCompetitorDomains()]);
  const conflicts = findKeywordIntentConflicts(keywords);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Keyword Tracking</h1>
        <p className="text-caption">
          Central keyword system: search intent, target market/language, target URL, search volume &amp; difficulty where available, current
          ranking, and status. Rank checks and metrics refreshes use DataForSEO and are run on demand.
        </p>
      </div>
      <KeywordTrackingManager keywords={keywords} competitors={competitors} conflicts={conflicts} />
    </div>
  );
}
