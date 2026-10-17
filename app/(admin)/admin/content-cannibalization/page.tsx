import { listCannibalizationPairsAction } from "@/app/(admin)/actions/content-cannibalization";
import CannibalizationListClient from "@/components/Admin/ContentCannibalization/CannibalizationListClient";

export default async function ContentCannibalizationPage() {
  const pairs = await listCannibalizationPairsAction();
  return <CannibalizationListClient pairs={pairs} />;
}
