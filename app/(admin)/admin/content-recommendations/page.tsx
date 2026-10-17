import { listRecommendationsAction } from "@/app/(admin)/actions/content-recommendations";
import RecommendationsListClient from "@/components/Admin/ContentRecommendations/RecommendationsListClient";

export default async function ContentRecommendationsPage() {
  const recommendations = await listRecommendationsAction();
  return <RecommendationsListClient recommendations={recommendations} />;
}
