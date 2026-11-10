import { getGa4Data } from "@/app/(admin)/actions/ga4-import";
import Ga4ImportManager from "@/components/Admin/Ga4ImportManager";
import PageTitle from "@/components/Admin/PageTitle";

// GA4's own data for the most recent day or two can still be processing,
// so the default range ends 2 days back rather than today.
function defaultDateRange() {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date();
  end.setDate(end.getDate() - 2);
  const start = new Date(end);
  start.setDate(start.getDate() - 28);
  return { startDate: fmt(start), endDate: fmt(end) };
}

export default async function Ga4ImportPage() {
  const { startDate, endDate } = defaultDateRange();
  const data = await getGa4Data({ startDate, endDate });

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>GA4 Analytics Integration</PageTitle>
        <p className="text-caption">
          Tracks organic sessions, landing pages, engagement, conversions, and conversion rate from Google Analytics — showing the SEO →
          Traffic → Conversion relationship per page.
        </p>
      </div>
      <Ga4ImportManager initialData={data} defaultStartDate={startDate} defaultEndDate={endDate} />
    </div>
  );
}
