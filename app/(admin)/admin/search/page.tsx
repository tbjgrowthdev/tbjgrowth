import { getContentSearchFacets } from "@/app/(admin)/actions/content-search";
import ContentSearchClient from "@/components/Admin/ContentSearchClient";

export default async function ContentSearchPage() {
  const facets = await getContentSearchFacets();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Advanced Search</h1>
        <p className="text-caption">Search and filter across posts, pages, case studies, and services at once.</p>
      </div>
      <ContentSearchClient facets={facets} />
    </div>
  );
}
