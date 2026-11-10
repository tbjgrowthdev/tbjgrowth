import { getTags, createTag, deleteTag } from "@/app/(admin)/actions/taxonomy";
import TaxonomyManager from "@/components/Admin/TaxonomyManager";
import PageTitle from "@/components/Admin/PageTitle";

export default async function TagsPage() {
  const tags = await getTags();

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Tags</PageTitle>
        <p className="text-caption">Fine-grained labels for blog posts.</p>
      </div>
      <TaxonomyManager
        entityName="tag"
        items={tags}
        createAction={createTag}
        deleteAction={deleteTag}
      />
    </div>
  );
}
