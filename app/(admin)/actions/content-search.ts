"use server";

import { searchContent, getSearchFacets, type SearchFilters } from "@/lib/content-search";
import { requireSession } from "@/lib/auth-guard";

// Read-only, cross-content-type search — a session is enough; it doesn't
// mutate anything and even a Contributor might reasonably search for their
// own content.
export async function searchAllContent(filters: SearchFilters) {
  try {
    await requireSession();
    return await searchContent(filters);
  } catch (error) {
    console.error("Failed to search content:", error);
    return [];
  }
}

export async function getContentSearchFacets() {
  try {
    await requireSession();
    return await getSearchFacets();
  } catch (error) {
    console.error("Failed to fetch search facets:", error);
    return { categories: [], tags: [], authors: [] };
  }
}
