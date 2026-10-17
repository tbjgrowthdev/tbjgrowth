import { listRefreshCandidatesAction } from "@/app/(admin)/actions/content-refresh";
import RefreshListClient from "@/components/Admin/ContentRefresh/RefreshListClient";

export default async function ContentRefreshPage() {
  const candidates = await listRefreshCandidatesAction();
  return <RefreshListClient candidates={candidates} />;
}
