import { getContentSearchFacets } from "@/app/(admin)/actions/content-search";
import ContentSearchClient from "@/components/Admin/ContentSearchClient";
import PageTitle from "@/components/Admin/PageTitle";

export default async function ContentSearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const facets = await getContentSearchFacets();
  const { q } = await searchParams;
  const initialQuery = (Array.isArray(q) ? q[0] : q)?.slice(0, 200) || undefined;

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Advanced Search</PageTitle>
        <p className="text-caption">Search and filter across posts, pages, case studies, and services at once.</p>
      </div>
      <ContentSearchClient facets={facets} initialQuery={initialQuery} />
    </div>
  );
}
