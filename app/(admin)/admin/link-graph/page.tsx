import { getInternalLinkGraphAction } from "@/app/(admin)/actions/link-graph";
import LinkGraphClient from "@/components/Admin/LinkGraphClient";

export default async function LinkGraphPage() {
  const result = await getInternalLinkGraphAction();
  return <LinkGraphClient result={result} />;
}
