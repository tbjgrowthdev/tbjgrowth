import { getTopicClustersAction } from "@/app/(admin)/actions/topic-clusters";
import TopicClustersClient from "@/components/Admin/TopicClustersClient";

export default async function TopicClustersPage() {
  const result = await getTopicClustersAction();
  return <TopicClustersClient result={result} />;
}
