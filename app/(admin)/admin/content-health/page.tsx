import { listHealthScoresAction } from "@/app/(admin)/actions/content-health";
import ContentHealthListClient from "@/components/Admin/ContentHealth/ContentHealthListClient";

export default async function ContentHealthPage() {
  const scores = await listHealthScoresAction();
  return <ContentHealthListClient scores={scores} />;
}
