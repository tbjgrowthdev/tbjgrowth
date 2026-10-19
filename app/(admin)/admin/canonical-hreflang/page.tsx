import { getCanonicalHreflangReport } from "@/app/(admin)/actions/canonical-hreflang";
import CanonicalHreflangClient from "@/components/Admin/CanonicalHreflang/CanonicalHreflangClient";

export default async function CanonicalHreflangPage() {
  const result = await getCanonicalHreflangReport();
  return <CanonicalHreflangClient initialResult={result} />;
}
