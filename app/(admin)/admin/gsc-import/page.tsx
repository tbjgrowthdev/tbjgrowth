import { getGscData } from "@/app/(admin)/actions/gsc-import";
import GscImportManager from "@/components/Admin/GscImportManager";

// GSC's own data for the most recent 1-3 days is provisional, so the
// default range ends 3 days back rather than today, matching the lag the
// rest of this codebase's GSC calls already work around.
function defaultDateRange() {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - 28);
  return { startDate: fmt(start), endDate: fmt(end) };
}

export default async function GscImportPage() {
  const { startDate, endDate } = defaultDateRange();
  const data = await getGscData({ startDate, endDate });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Search Console Import</h1>
        <p className="text-caption">
          Imports queries, clicks, impressions, CTR, position, pages, countries, and devices from Google Search Console for a chosen date
          range, and maps each page to its CMS content.
        </p>
      </div>
      <GscImportManager initialData={data} defaultStartDate={startDate} defaultEndDate={endDate} />
    </div>
  );
}
